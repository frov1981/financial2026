import { AppDataSource } from "../config/typeorm.datasource"
import { Account } from "../entities/Account.entity"
import { Category } from "../entities/Category.entity"
import { Loan } from "../entities/Loan.entity"
import { LoanGroup } from "../entities/LoanGroup.entity"
import { AuthRequest } from "../types/auth-request"
import { cacheKeys } from "./cache-key.service"
import { cache } from "./cache.service"

type DTOLoan = {
    id: number
    name: string
    total_amount: number
    principal_paid: number
    interest_paid: number
    balance: number
    start_date: Date
    end_date: Date | null
    is_active: boolean
    created_at: Date
    note: string | null
    disbursement_account: Account | null
    category: Category | null
    loan_group: LoanGroup | null
}

type DTOLoanGroupTotal = {
    loan_group_id: number
    loan_group_name: string
    total_balance: number
}

const getLoansBase = async (user_id: number): Promise<Loan[]> => {
    const cache_key = cacheKeys.loansByUser(user_id)
    const cached_loans = cache.get<Loan[]>(cache_key)
    if (cached_loans !== undefined) {
        return cached_loans
    }
    const repo = AppDataSource.getRepository(Loan)
    const loans: Loan[] = await repo.find({
        where: { user: { id: user_id } },
        relations: { loan_group: true, category: true, disbursement_account: true, transaction: true, payments: true },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, loans)
    return loans
}

export const getLoans = async (auth_req: AuthRequest): Promise<Loan[]> => {
    const user_id = auth_req.user.id
    const loans: Loan[] = await getLoansBase(user_id)
    return loans
}

export const getLoanById = async (auth_req: AuthRequest, loan_id: number): Promise<Loan | null> => {
    const user_id = auth_req.user.id
    const loans = await getLoansBase(user_id)
    const loan = loans.find(loan => loan.id === loan_id)
    return loan || null
}

export const getLoanByName = async (auth_req: AuthRequest, name: string): Promise<Loan | null> => {
    const user_id = auth_req.user.id
    const loans = await getLoansBase(user_id)
    const loan = loans.find(loan => loan.name.toLowerCase() === name.toLowerCase())
    return loan || null
}

export const getActiveLoanById = async (auth_req: AuthRequest, loan_id: number): Promise<Loan | null> => {
    const user_id = auth_req.user.id
    const loans = await getLoansBase(user_id)
    const loan = loans.find(loan => loan.id === loan_id && loan.is_active)
    return loan || null
}

export const getActiveLoans = async (auth_req: AuthRequest): Promise<Loan[]> => {
    const user_id = auth_req.user.id
    const loans: Loan[] = await getLoansBase(user_id)
    const active_loans: Loan[] = loans.filter(loan => loan.is_active)
    return active_loans
}

export const getInactiveLoans = async (auth_req: AuthRequest): Promise<Loan[]> => {
    const user_id = auth_req.user.id
    const loans: Loan[] = await getLoansBase(user_id)
    const inactive_loans: Loan[] = loans.filter(loan => !loan.is_active)
    return inactive_loans
}

export const getLoansForApi = async (auth_req: AuthRequest): Promise<{ loans: DTOLoan[], group_totals: DTOLoanGroupTotal[] }> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.loansByUserForApi(user_id)
    const cached_loans = cache.get<{ loans: DTOLoan[], group_totals: DTOLoanGroupTotal[] }>(cache_key)
    if (cached_loans !== undefined) {
        return cached_loans
    }

    const repository = AppDataSource.getRepository(Loan)
    const result = await repository
        .createQueryBuilder('loan')
        .leftJoinAndSelect('loan.loan_group', 'loan_group')
        .leftJoinAndSelect('loan.disbursement_account', 'disbursement_account')
        .leftJoinAndSelect('loan.category', 'category')
        .where('loan.user_id = :user_id', { user_id })
        .orderBy('loan_group.name', 'ASC')
        .addOrderBy('loan.name', 'ASC')
        .getMany()

    const loans: DTOLoan[] = result.map(loan => ({
        id: loan.id,
        name: loan.name,
        total_amount: loan.total_amount,
        principal_paid: loan.principal_paid,
        interest_paid: loan.interest_paid,
        balance: loan.balance,
        start_date: loan.start_date,
        end_date: loan.end_date,
        is_active: loan.is_active,
        created_at: loan.created_at,
        note: loan.note,
        disbursement_account: loan.disbursement_account,
        category: loan.category,
        loan_group: loan.loan_group
    }))

    const group_totals_map: Record<number, DTOLoanGroupTotal> = {}
    for (const loan of result) {
        if (!loan.loan_group) continue
        const group_id = loan.loan_group.id
        if (!group_totals_map[group_id]) {
            group_totals_map[group_id] = {
                loan_group_id: group_id,
                loan_group_name: loan.loan_group.name,
                total_balance: 0
            }
        }
        group_totals_map[group_id].total_balance += Number(loan.balance)
    }

    const group_totals = Object.values(group_totals_map)
    const response = { loans, group_totals }
    cache.set(cache_key, response)
    return response
}