export type AccountFormMode = 'insert' | 'update' | 'delete' | 'status'

export type AccountFieldPolicy = 'edit' | 'read' | 'hidden'

export const accountFormMatrix: Record<AccountFormMode, Record<string, AccountFieldPolicy>> = {
    insert: {
        type: 'edit',
        name: 'edit',
        is_active: 'hidden'
    },
    update: {
        type: 'read',
        name: 'edit',
        is_active: 'edit'
    },
    delete: {
        type: 'hidden',
        name: 'read',
        is_active: 'read'
    },
    status: {
        type: 'hidden',
        name: 'read',
        is_active: 'edit'
    }
}
