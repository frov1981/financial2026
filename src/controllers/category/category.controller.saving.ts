import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/datasource'
import { Category } from '../../entities/Category.entity'
import { AuthRequest } from '../../types/AuthRequest'
import { logger } from '../../utils/logger.util'
import { getActiveParentCategoriesByUser } from './category.controller.auxiliar'
import { validateCategory, validateDeleteCategory } from './category.controller.validator'

export const saveCategory: RequestHandler = async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    const repoCategory = AppDataSource.getRepository(Category)
    const parentCategories = await getActiveParentCategoriesByUser(authReq)
    const action = req.body.action || 'save'
    const isParent = req.body.is_parent === 'true'
    const selectedParent = !isParent ? parentCategories.find(c => c.id === Number(req.body.parent_id)) || null : null
    const transactionId = req.params.id ? Number(req.params.id) : req.body.id ? Number(req.body.id) : undefined

    let transaction: Category
    let mode

    if (action === 'save') {
        if (transactionId) {
            const existing = await repoCategory.findOne({
                where: { id: transactionId, user: { id: authReq.user.id } },
                relations: { parent: true }
            })
            if (!existing) return res.redirect('/categories')

            if (req.body.is_active !== undefined) {
                mode = 'status'
                existing.is_active = req.body.is_active === 'true'
            } else {
                mode = 'update'
                if (req.body.name) existing.name = req.body.name
                existing.parent = selectedParent
            }
            transaction = existing
        } else {
            mode = 'insert'
            transaction = repoCategory.create({
                user: { id: authReq.user.id },
                type: req.body.type,
                name: req.body.name,
                parent: selectedParent,
                is_active: true
            })
        }

        logger.info('Before saving category', { userId: authReq.user.id, mode, transaction })
        const errors = await validateCategory(transaction, authReq)
        if (errors) {
            return res.render('layouts/main', {
                title: mode === 'insert' ? 'Insertar Categoría' : mode === 'update' ? 'Editar Categoría' : 'Cambiar Estado de Categoría',
                view: 'pages/categories/form',
                category: {
                    ...req.body,
                    is_active: req.body.is_active === 'true',
                    parent: selectedParent,
                    is_parent: isParent
                },
                parentCategories,
                errors,
                mode
            })
        }

        await repoCategory.save(transaction)
        logger.info('Category saved to database.')
        return res.redirect('/categories')
    }

    if (action === 'delete') {
        mode = 'delete'
        const existing = await repoCategory.findOne({
            where: { id: transactionId, user: { id: authReq.user.id } },
            relations: { parent: true }
        })
        if (!existing) return res.redirect('/categories')

        logger.info('Before deleting category', { userId: authReq.user.id, mode, existing })
        const errors = await validateDeleteCategory(existing, authReq)
        if (errors) {
            return res.render('layouts/main', {
                title: 'Eliminar Categoría',
                view: 'pages/categories/form',
                category: {
                    ...req.body,
                    parent: existing.parent || null,
                    is_parent: !existing.parent
                },
                parentCategories,
                errors,
                mode
            })
        }
        await repoCategory.delete(existing.id)
        logger.info('Category deleted from database.')
        return res.redirect('/categories')
    }
}
