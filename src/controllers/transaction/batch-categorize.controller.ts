import { Request, RequestHandler, Response } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Category } from '../../entities/Category.entity';
import { Transaction } from '../../entities/Transaction.entity';
import { getActiveCategoriesByUser } from '../../services/populate-items.service';
import { AuthRequest } from '../../types/auth-request';
import { logger } from '../../utils/logger.util';
import { splitCategoriesByType } from './transaction.auxiliar';

export const apiForGettingCategorizeTransactions: RequestHandler = async (req: Request, res: Response) => {
    const auth_req = req as AuthRequest;
    const ids_raw = String(req.query.ids || '');
    const ids = ids_raw.split(',').map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0);

    if (!ids.length) {
        return res.redirect('/transactions');
    }

    const active_categories = await getActiveCategoriesByUser(auth_req)
    const { active_income_categories, active_expense_categories } = splitCategoriesByType(active_categories)

    const repo_transaction = AppDataSource.getRepository(Transaction);
    const transactions = await repo_transaction.find({
        where: {
            id: In(ids),
            type: In(['income', 'expense']),
            user: { id: auth_req.user.id }
        },
        relations: {
            category: true, loan: true, loan_payment: true
        },
        select: {
            id: true, type: true, amount: true, date: true, description: true,
            category: {
                id: true, name: true
            }
        }
    })

    logger.info(`Data for batch`, transactions)
    const has_income = transactions.some(t => t.type === 'income')
    const has_expense = transactions.some(t => t.type === 'expense')

    res.render(
        'layouts/main',
        {
            title: 'Categorizar Transacciones',
            view: 'pages/transactions/batch-categorize',
            active_income_categories,
            active_expense_categories,
            transactions,
            has_income,
            has_expense,
            USER_ID: auth_req.user?.id || 'guest',
        }
    )
}

export const apiForBatchCategorize: RequestHandler = async (req: Request, res: Response) => {
    const auth_req = req as AuthRequest
    const user_id = auth_req.user.id

    try {
        const { income_category_id, expense_category_id, income_ids = '[]', expense_ids = '[]' } = req.body
        
        // Parse JSON strings to arrays
        const income_ids_arr = typeof income_ids === 'string' ? JSON.parse(income_ids) : income_ids
        const expense_ids_arr = typeof expense_ids === 'string' ? JSON.parse(expense_ids) : expense_ids
        
        const all_ids = [...income_ids_arr, ...expense_ids_arr]
        logger.debug(`${apiForBatchCategorize.name} - Start with data: [${all_ids}], income_category_id: [${income_category_id}], expense_category_id: [${expense_category_id}]`)

        if (!all_ids.length) {
            throw new Error('No se proporcionaron transacciones para categorizar')
        }

        /* ============================================================
        1. Re-cargar categorías activas (para re-render en caso error)
        ============================================================ */
        const active_categories = await getActiveCategoriesByUser(auth_req)
        const { active_income_categories, active_expense_categories } = splitCategoriesByType(active_categories)

        /* ============================================================
        2. Re-cargar transacciones seleccionadas
        ============================================================ */
        const repo_transaction = AppDataSource.getRepository(Transaction)

        const transactions = await repo_transaction.find({
            where: { id: In(all_ids), type: In(['income', 'expense']), user: { id: user_id } },
            relations: { category: true },
            select: { id: true, type: true, amount: true, date: true, description: true, category: { id: true, name: true } }
        })

        const has_income = transactions.some(t => t.type === 'income')
        const has_expense = transactions.some(t => t.type === 'expense')

        /* ============================================================
        3. Validaciones de consistencia
        ============================================================ */
        if (income_ids_arr.length && !income_category_id) {
            throw new Error('Debe seleccionar categoría de ingresos')
        }

        if (expense_ids_arr.length && !expense_category_id) {
            throw new Error('Debe seleccionar categoría de gastos')
        }

        /* ============================================================
        4. Validar categorías pertenezcan al usuario
        ============================================================ */
        const categoryRepo = AppDataSource.getRepository(Category)

        if (income_category_id) {
            const incomeCategory = await categoryRepo.findOne({
                where: { id: income_category_id, user: { id: user_id } }
            })

            if (!incomeCategory) {
                throw new Error('Categoría de ingresos inválida')
            }
        }

        if (expense_category_id) {
            const expenseCategory = await categoryRepo.findOne({
                where: { id: expense_category_id, user: { id: user_id } }
            })

            if (!expenseCategory) {
                throw new Error('Categoría de gastos inválida')
            }
        }

        /* ============================================================
        5. Procesar actualización (SOLO category)
        ============================================================ */
        await AppDataSource.transaction(async manager => {

            logger.debug(`${apiForBatchCategorize.name} - Updating transactions`, { income_ids: income_ids_arr, expense_ids: expense_ids_arr, income_category_id, expense_category_id })

            if (income_ids_arr.length) {
                await manager
                    .createQueryBuilder()
                    .update(Transaction)
                    .set({ category: income_category_id })
                    .where('id IN (:...ids)', { ids: income_ids_arr })
                    .andWhere('user.id = :user_id', { user_id })
                    .andWhere('type = :type', { type: 'income' })
                    .execute()
            }


            if (expense_ids_arr.length) {
                await manager
                    .createQueryBuilder()
                    .update(Transaction)
                    .set({ category: expense_category_id })
                    .where('id IN (:...ids)', { ids: expense_ids_arr })
                    .andWhere('user.id = :user_id', { user_id })
                    .andWhere('type = :type', { type: 'expense' })
                    .execute()
            }

        })

        /* ============================================================
        6. Redirigir si todo correcto
        ============================================================ */
        return res.redirect('/transactions?saved_batch=true')

    } catch (error) {
        logger.error(`${apiForBatchCategorize.name} - Error`, error)

        const active_categories = await getActiveCategoriesByUser(auth_req)
        const { active_income_categories, active_expense_categories } = splitCategoriesByType(active_categories)

        return res.status(500).render('layouts/main', {
            title: 'Categorizar Transacciones',
            view: 'pages/transactions/batch-categorize',
            active_income_categories,
            active_expense_categories,
            transactions: [],
            has_income: false,
            has_expense: false,
            errors: { general: 'Error interno del servidor' },
            USER_ID: auth_req.user?.id
        })
    }

}
