import { LoanFormMatrix, } from "../types/form-view-params";

export const loanFormMatrix: LoanFormMatrix = {
    insert: {
        name: 'edit',
        total_amount: 'edit',
        start_date: 'edit',
        loan_group_id: 'edit',
        disbursement_account_id: 'edit',
        category_id: 'edit',
        note: 'edit',
        is_active: 'hidden'
    },

    update: {
        name: 'edit',
        total_amount: 'edit',
        start_date: 'edit',
        loan_group_id: 'edit',
        disbursement_account_id: 'edit',
        category_id: 'edit',
        note: 'edit',
        is_active: 'hidden'
    },

    delete: {
        name: 'read',
        total_amount: 'read',
        start_date: 'read',
        loan_group_id: 'read',
        disbursement_account_id: 'read',
        category_id: 'read',
        note: 'read',
        is_active: 'read'
    }
}
