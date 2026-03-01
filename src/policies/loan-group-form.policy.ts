export type LoanGroupFieldMode = 'hidden' | 'read' | 'edit'
export type LoanGroupFormMode = 'insert' | 'update' | 'delete'

export const loanGroupFormMatrix: Record<LoanGroupFormMode, Record<string, LoanGroupFieldMode>> = {
    insert: {
        name: 'edit',
        is_active: 'hidden'
    },

    update: {
        name: 'edit',
        is_active: 'read'
    },

    delete: {
        name: 'read',
        is_active: 'read'
    },
}
