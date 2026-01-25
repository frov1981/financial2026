import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/datasource'
import { Category } from '../../entities/Category.entity'
import { AuthRequest } from '../../types/AuthRequest'
import { logger } from '../../utils/logger.util'
import { validateCategory, validateDeleteCategory } from './category.controller.validator'
import { getActiveParentCategoriesByUser } from './category.controller.auxiliar'

export const saveCategory: RequestHandler = async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    const repo = AppDataSource.getRepository(Category)

    const parentCategories = await getActiveParentCategoriesByUser(authReq)

    const isParent = req.body.is_parent === 'true'
    const selectedParent = !isParent
        ? parentCategories.find(c => c.id === Number(req.body.parent_id)) || null
        : null

    const txId = req.body.id
        ? Number(req.body.id)
        : req.params.id
            ? Number(req.params.id)
            : undefined

    const action = req.body.action || 'save'

    let tx: Category
    let mode

    logger.warn('Body info received', req.body)

    if (action === 'save') {

        if (txId) {
            const existing = await repo.findOne({
                where: { id: txId, user: { id: authReq.user.id } },
                relations: ['parent']
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

            tx = existing

        } else {
            mode = 'insert'
            tx = repo.create({
                user: { id: authReq.user.id },
                type: req.body.type,
                name: req.body.name,
                parent: selectedParent,
                is_active: true
            })
        }

        logger.info('Before saving category', { userId: authReq.user.id, mode, tx })

        const errors = await validateCategory(tx, authReq)

        if (errors) {
            return res.render('layouts/main', {
                title:
                    mode === 'insert'
                        ? 'Insertar Categoría'
                        : mode === 'update'
                            ? 'Editar Categoría'
                            : 'Cambiar Estado de Categoría',
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

        await repo.save(tx)
        logger.info('Category saved to database.')
        return res.redirect('/categories')
    }

    if (action === 'delete') {
        const existing = await repo.findOne({
            where: { id: txId, user: { id: authReq.user.id } },
            relations: ['parent']
        })

        if (!existing) return res.redirect('/categories')

        mode = 'delete'

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

        await repo.delete(existing.id)
        logger.info('Category deleted from database.')
        return res.redirect('/categories')
    }
}
