export type TransactionFormMode = 'insert' | 'update' | 'delete' | 'clone'

export type TransactionFieldPolicy = 'edit' | 'read' | 'hidden'

export const transactionFormMatrix: Record<TransactionFormMode, Record<string, TransactionFieldPolicy>> = {
    insert: {
        type: 'edit',
        account: 'edit',
        to_account: 'edit',
        category: 'edit',
        amount: 'edit',
        date: 'edit',
        description: 'edit'
    },

    update: {
        type: 'read',
        account: 'edit',
        to_account: 'edit',
        category: 'edit',
        amount: 'edit',
        date: 'edit',
        description: 'edit'
    },

    delete: {
        type: 'read',
        account: 'read',
        to_account: 'read',
        category: 'read',
        amount: 'read',
        date: 'read',
        description: 'read'
    },

    clone: {
        type: 'edit',
        account: 'edit',
        to_account: 'edit',
        category: 'edit',
        amount: 'edit',
        date: 'edit',
        description: 'edit'
    }
}
