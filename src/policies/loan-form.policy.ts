export type LoanFieldMode = 'hidden' | 'read' | 'edit'
export type LoanFormMode = 'insert' | 'update' | 'delete'

export const loanFormMatrix: Record<LoanFormMode, Record<string, LoanFieldMode>> = {
    insert: {
        name: 'edit',
        loan_group_id: 'edit',
        total_amount: 'edit',
        start_date: 'edit',
        disbursement_account_id: 'edit',
        note: 'edit',
        is_active: 'hidden'
    },

    update: {
        name: 'edit',
        loan_group_id: 'edit',
        total_amount: 'edit',
        start_date: 'edit',
        disbursement_account_id: 'edit',
        note: 'edit',
        is_active: 'hidden'
    },

    delete: {
        name: 'read',
        loan_group_id: 'read',
        total_amount: 'read',
        start_date: 'read',
        disbursement_account_id: 'hidden',
        note: 'read',
        is_active: 'hidden'
    }
}
