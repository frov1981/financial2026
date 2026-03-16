import { LoanFormMatrix, } from "../types/form-view-params";

export const loanFormMatrix: LoanFormMatrix = {
    insert: {
        name: 'editable',
        total_amount: 'editable',
        start_date: 'editable',
        loan_group_id: 'editable',
        disbursement_account_id: 'editable',
        category_id: 'editable',
        note: 'editable',
        is_active: 'readonly'
    },

    update: {
        name: 'editable',
        total_amount: 'editable',
        start_date: 'editable',
        loan_group_id: 'editable',
        disbursement_account_id: 'editable',
        category_id: 'editable',
        note: 'editable',
        is_active: 'readonly'
    },

    delete: {
        name: 'readonly',
        total_amount: 'readonly',
        start_date: 'readonly',
        loan_group_id: 'readonly',
        disbursement_account_id: 'readonly',
        category_id: 'readonly',
        note: 'readonly',
        is_active: 'readonly'
    }
}
