// controllers/category.controller.saving.ts
import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/datasource'
import { Category } from '../../entities/Category.entity'
import { AuthRequest } from '../../types/AuthRequest'
import { logger } from '../../utils/logger.util'
import { validateCategory, validateDeleteCategory } from './category.controller.validator'

export const saveCategory: RequestHandler = async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    const repo = AppDataSource.getRepository(Category)
    const txId = req.body.id ? Number(req.body.id) : req.params.id ? Number(req.params.id) : undefined
    const action = req.body.action || 'save'

    let tx: Category
    let mode

    if (action === 'save') {
        if (txId) {
            const existing = await repo.findOne({
                where: { id: txId, user: { id: authReq.user.id } }
            })

            if (!existing) {
                return res.redirect('/categories')
            }

            if (req.body.is_active !== undefined) {
                mode = 'status'
                existing.is_active = req.body.is_active === 'true'
            } else {
                mode = 'update'
                if (req.body.name) { existing.name = req.body.name }
            }

            tx = existing
        } else {
            mode = 'insert'
            tx = repo.create({
                user: { id: authReq.user.id },
                type: req.body.type,
                name: req.body.name,
                is_active: true
            })
        }

        logger.info(`Before saving category`, { userId: authReq.user.id, mode, tx })

        const errors = await validateCategory(tx, authReq)

        if (errors) {
            return res.render('layouts/main', {
                title: '',
                view: 'pages/categories/form',
                category: {
                    ...req.body,
                    is_active: req.body.is_active === 'true' ? true : false
                },
                errors,
                mode
            })
        }

        await repo.save(tx)
        logger.info(`Category saved to database.`)
        res.redirect('/categories')

    } else if (action === 'delete') {
        const existing = await repo.findOne({ where: { id: txId, user: { id: authReq.user.id } } })
        if (!existing) {
            return res.redirect('/categories')
        }

        mode = 'delete'
        if (req.body.type) { existing.type = req.body.type }
        if (req.body.name) { existing.name = req.body.name }

        logger.info(`Before deleting category`, { userId: authReq.user.id, mode, existing })

        const errors = await validateDeleteCategory(existing, authReq)

        if (errors) {
            return res.render('layouts/main', {
                title: '',
                view: 'pages/categories/form',
                category: {
                    ...req.body,
                    is_active: req.body.is_active === 'true' ? true : false
                },
                errors,
                mode,
            })
        }

        await repo.delete(existing.id)
        logger.info(`Category deleted from database.`)
        res.redirect('/categories')
    }
}
