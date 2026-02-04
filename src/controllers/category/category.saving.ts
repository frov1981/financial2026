import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/category.entity'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { getActiveParentCategoriesByUser } from './category.auxiliar'
import { validateCategory, validateDeleteCategory } from './category.validator'

export const saveCategory: RequestHandler = async (req: Request, res: Response) => {
    logger.debug('saveCategory called', { body: req.body, param: req.params })

    const authReq = req as AuthRequest
    const categoryId = req.params.id ? Number(req.params.id) : req.body.id ? Number(req.body.id) : undefined
    const action = req.body.action || 'save'
    const isParent = req.body.is_parent === 'true'

    const parentCategories = await getActiveParentCategoriesByUser(authReq)
    const selectedParent = !isParent ? parentCategories.find(c => c.id === Number(req.body.parent_id)) || null : null

    const formState = {
        category: {
            ...req.body,
            is_active: req.body.is_active === 'true',
            parent: selectedParent,
            is_parent: isParent
        },
        parentCategories,
        mode: action === 'delete' ? 'delete' : categoryId ? 'update' : 'insert'
    }

    const repoCategory = AppDataSource.getRepository(Category)

    try {
        let transaction: Category
        let mode: string

        if (action === 'save') {
            if (categoryId) {
                const existing = await repoCategory.findOne({
                    where: { id: categoryId, user: { id: authReq.user.id } },
                    relations: { parent: true }
                })
                if (!existing) throw new Error('Categoría no encontrada')

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
                    user: { id: authReq.user.id } as any,
                    type: req.body.type,
                    name: req.body.name,
                    parent: selectedParent,
                    is_active: true
                })
            }

            logger.info('Before saving category', { userId: authReq.user.id, mode, transaction })

            const errors = await validateCategory(transaction, authReq)
            if (errors) throw { validationErrors: errors }

            await repoCategory.save(transaction)
            logger.info('Category saved to database.')

            return res.redirect('/categories')
        }

        if (action === 'delete') {
            const existing = await repoCategory.findOne({
                where: { id: categoryId, user: { id: authReq.user.id } },
                relations: { parent: true }
            })
            if (!existing) throw new Error('Categoría no encontrada')

            logger.info('Before deleting category', { userId: authReq.user.id, mode: 'delete', existing })

            const errors = await validateDeleteCategory(existing, authReq)
            if (errors) throw { validationErrors: errors }

            await repoCategory.delete(existing.id)
            logger.info('Category deleted from database.')

            return res.redirect('/categories')
        }

        throw new Error('Acción no soportada')
    } catch (err: any) {
        logger.error('Error saving category', {
            userId: authReq.user.id,
            categoryId,
            action,
            error: err,
            stack: err?.stack
        })

        const validationErrors = err?.validationErrors || null

        return res.render('layouts/main', {
            title:
                formState.mode === 'delete'
                    ? 'Eliminar Categoría'
                    : formState.mode === 'insert'
                        ? 'Insertar Categoría'
                        : formState.mode === 'update'
                            ? 'Editar Categoría'
                            : 'Categoría',
            view: 'pages/categories/form',
            ...formState,
            errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
        })
    } finally {
        // No hay queryRunner aquí, pero dejamos el finally para mantener el patrón homogéneo
    }
}
