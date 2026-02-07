export type LoanFieldMode = 'hidden' | 'read' | 'edit'
export type LoanFormMode = 'insert' | 'update' | 'delete'
export type LoanRole = 'parent' | 'child'

export const loanFormMatrix: Record<LoanFormMode, Record<LoanRole, Record<string, LoanFieldMode>>> = {
    insert: {
        parent: {
            is_parent: 'hidden',
            name: 'edit',
            total_amount: 'hidden',
            start_date: 'hidden',
            disbursement_account_id: 'hidden',
            parent_id: 'hidden',
            note: 'hidden',
            is_active: 'hidden'
        },
        child: {
            is_parent: 'edit',
            name: 'edit',
            total_amount: 'edit',
            start_date: 'edit',
            disbursement_account_id: 'edit',
            parent_id: 'edit',
            note: 'edit',
            is_active: 'hidden'
        }
    },

    update: {
        parent: {
            is_parent: 'hidden',
            name: 'edit',
            total_amount: 'hidden',
            start_date: 'hidden',
            disbursement_account_id: 'hidden',
            parent_id: 'hidden',
            note: 'hidden',
            is_active: 'hidden'
        },
        child: {
            is_parent: 'hidden',
            name: 'edit',
            total_amount: 'edit',
            start_date: 'edit',
            disbursement_account_id: 'edit',
            parent_id: 'edit',
            note: 'edit',
            is_active: 'hidden'
        }
    },

    delete: {
        parent: {
            is_parent: 'hidden',
            name: 'read',
            total_amount: 'hidden',
            start_date: 'hidden',
            disbursement_account_id: 'hidden',
            parent_id: 'hidden',
            note: 'hidden',
            is_active: 'hidden'
        },
        child: {
            is_parent: 'hidden',
            name: 'read',
            total_amount: 'read',
            start_date: 'read',
            disbursement_account_id: 'hidden',
            parent_id: 'hidden',
            note: 'read',
            is_active: 'hidden'
        }
    },

}
