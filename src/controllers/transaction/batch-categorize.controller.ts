import { Request, RequestHandler, Response } from 'express'
import { AuthRequest } from '../../types/auth-request'
import { AppDataSource } from '../../config/typeorm.datasource';
import { Transaction } from '../../entities/Transaction.entity';
import { In } from 'typeorm';
import { getActiveCategoriesByUser } from '../../services/populate-items.service';
import { splitCategoriesByType } from './transaction.auxiliar';
import { logger } from '../../utils/logger.util';


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