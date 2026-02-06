import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { getActiveParentCategoriesByUser } from './category.auxiliar'
import { validateCategory, validateDeleteCategory } from './category.validator'
import { categoryFormMatrix, CategoryFormMode } from '../../policies/category-form.policy'

const getTitle = (mode: string) => {
    switch (mode) {
        case 'insert': return 'Insertar Categoría'
        case 'update': return 'Editar Categoría'
        case 'status': return 'Editar Estado de la Categoría'
        case 'delete': return 'Eliminar Categoría'
        default: return 'Indefinido'
    }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: CategoryFormMode, role: 'parent' | 'child', body: any) => {
    const policy = categoryFormMatrix[mode][role]
    const clean: any = {}

    for (const field in policy) {
        if (policy[field] === 'edit' && body[field] !== undefined) {
            clean[field] = body[field]
        }
    }

    return clean
}

export const saveCategory: RequestHandler = async (req: Request, res: Response) => {
    logger.debug('saveCategory called', { body: req.body, param: req.params })

    const authReq = req as AuthRequest
    const categoryId = req.params.id ? Number(req.params.id) : req.body.id ? Number(req.body.id) : undefined
    const mode: CategoryFormMode = req.body.mode || 'insert'

    const repoCategory = AppDataSource.getRepository(Category)

    try {
        const parentCategories = await getActiveParentCategoriesByUser(authReq)

        let existing: Category | null = null
        if (categoryId) {
            existing = await repoCategory.findOne({
                where: { id: categoryId, user: { id: authReq.user.id } },
                relations: { parent: true }
            })
            if (!existing) throw new Error('Categoría no encontrada')
        }

        const isParent = existing ? !existing.parent : req.body.is_parent === 'true'
        const role: 'parent' | 'child' = isParent ? 'parent' : 'child'

        /* ============================
           DELETE
        ============================ */
        if (mode === 'delete') {
            if (!existing) throw new Error('Categoría no encontrada')

            logger.info('Before deleting category', { userId: authReq.user.id, mode, existing })

            const errors = await validateDeleteCategory(existing, authReq)
            if (errors) throw { validationErrors: errors }

            await repoCategory.delete(existing.id)
            logger.info('Category deleted from database.')

            return res.redirect('/categories')
        }

        /* ============================
           INSERT / UPDATE / STATUS
        ============================ */
        let category: Category

        if (mode === 'insert') {
            const selectedParent = req.body.parent_id
                ? parentCategories.find(c => c.id === Number(req.body.parent_id)) || null
                : null

            category = repoCategory.create({
                user: { id: authReq.user.id } as any,
                type: req.body.type,
                name: req.body.name,
                parent: selectedParent,
                is_active: true
            })
        } else {
            if (!existing) throw new Error('Categoría no encontrada')
            category = existing
        }

        const clean = sanitizeByPolicy(mode, role, req.body)

        if (clean.name !== undefined) {
            category.name = clean.name
        }

        if (clean.type !== undefined) {
            category.type = clean.type
        }

        if (clean.parent_id !== undefined) {
            const selectedParent = clean.parent_id
                ? parentCategories.find(c => c.id === Number(clean.parent_id)) || null
                : null

            category.parent = selectedParent
        }

        if (clean.is_active !== undefined) {
            category.is_active = clean.is_active === 'true'
        }

        logger.info('Before saving category', { userId: authReq.user.id, mode, category })

        const errors = await validateCategory(category, authReq)
        if (errors) throw { validationErrors: errors }

        await repoCategory.save(category)
        logger.info('Category saved to database.')

        return res.redirect('/categories')
    } catch (err: any) {
        logger.error('Error saving category', {
            userId: authReq.user.id,
            categoryId,
            mode,
            error: err,
            stack: err?.stack
        })

        const parentCategories = await getActiveParentCategoriesByUser(authReq)
        const validationErrors = err?.validationErrors || null

        const isParent = !req.body.parent_id
        const role: 'parent' | 'child' = isParent ? 'parent' : 'child'
        const categoryFormPolicy = categoryFormMatrix[mode][role]

        return res.render('layouts/main', {
            title: getTitle(mode),
            view: 'pages/categories/form',
            category: { ...req.body },
            errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' },
            categoryFormPolicy,
            parentCategories,
            mode
        })
    }
}
