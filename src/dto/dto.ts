import { CategoryType } from '../types/category-type'
import { CategoryTypeForPayableOrReceivable } from '../types/category-type-for-payable-or-receivable'

export type DTOAccount = {
    id: number
    name: string
    type: string
    balance: number
    is_active: boolean
    transaction_count: number
}

export type DTOCategory = {
    id: number
    name: string
    type: CategoryType
    type_for_payable_or_receivable: CategoryTypeForPayableOrReceivable
    is_active: boolean
    category_group: { id: number, name: string } | null
    transactions_count: number
}

export type DTOPayable = {
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
    disbursement_account: { id: number, name: string } | null
    category: { id: number, name: string } | null
    payable_group: { id: number, name: string } | null
}

export type DTOPayableGroupTotal = {
    payable_group_id: number
    payable_group_name: string
    total_balance: number
}

export type DTOPayablesResponse = {
    payables: DTOPayable[]
    group_totals: DTOPayableGroupTotal[]
}

export type DTOPayablePayment = {
    id: number
    payment_number: number
    principal_paid: number
    interest_paid: number
    payment_date: Date
    note: string | null
    created_at: Date
    account: { id: number, name: string } | null
    category: { id: number, name: string } | null
    payable: { id: number, name: string } | null
}

export type DTOReceivable = {
    id: number
    name: string
    total_amount: number
    principal_received: number
    interest_received: number
    balance: number
    start_date: Date
    end_date: Date | null
    is_active: boolean
    created_at: Date
    note: string | null
    disbursement_account: { id: number, name: string } | null
    category: { id: number, name: string } | null
    receivable_group: { id: number, name: string } | null
}

export type DTOReceivableGroupTotal = {
    receivable_group_id: number
    receivable_group_name: string
    total_balance: number
}

export type DTOReceivablesResponse = {
    receivables: DTOReceivable[]
    group_totals: DTOReceivableGroupTotal[]
}

export type DTOReceivableCollection = {
    id: number
    collection_number: number
    principal_received: number
    interest_received: number
    collection_date: Date
    note: string | null
    created_at: Date
    account: { id: number, name: string } | null
    category: { id: number, name: string } | null
    receivable: { id: number, name: string } | null
}

export type DTOHomeCashFlowSummary = {
    labels: string[]
    total_inflows: number[]
    total_outflows: number[]
    net_cash_flow: number[]
}

export type DTOHomePayableFlowSummary = {
    labels: string[]
    total_payables: number[]
    total_payable_payments: number[]
    net_balance: number[]
}

export type DTOHomeReceivableFlowSummary = {
    labels: string[]
    total_receivables: number[]
    total_receivable_collections: number[]
    net_balance: number[]
}

export type DTOHomeKpiBalance = {
    incomes: number
    expenses: number
    payables: number
    receivables: number
    receivable_collections: number
    payable_payments: number
    savings: number
    withdrawals: number
    total_inflows: number
    total_outflows: number
    net_cash_flow: number
    net_savings: number
    available_balance: number
    principal_breakdown: number
    interest_breakdown: number
    is_populate: number
}

export type DTOHomeTrendValue = {
    diff: number
    percent: number | null
    direction: 'up' | 'down' | 'equal'
} | null

export type DTOHomeKpiTrend = {
    [K in Exclude<keyof DTOHomeKpiBalance, 'is_populate'>]: DTOHomeTrendValue
}

export type DTOHomeTrendResponse = {
    current: DTOHomeKpiBalance
    previous: DTOHomeKpiBalance | null
    trend: DTOHomeKpiTrend | null
}

export type DTOHomeCategoryKpi = {
    category_group_id: number
    category_id: number
    cat_group_name: string
    cat_name: string
    amount: number
    transaction_count: number
}

export type DTOHomeCategoryKpiDetail = {
    year_period: number
    month_period: number | null
    amount: number
    transaction_count: number
}

export type DTOHomeCategoryGroupKpi = {
    category_group_id: number
    cat_group_name: string
    amount: number
    transaction_count: number
}

export type DTOHomeCategoryGroupKpiDetail = {
    year_period: number
    month_period: number | null
    amount: number
    transaction_count: number
}