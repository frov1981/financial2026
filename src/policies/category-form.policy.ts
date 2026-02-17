export type CaterogyFieldMode = 'hidden' | 'read' | 'edit'
export type CategoryFormMode = 'insert' | 'update' | 'delete' | 'status'

export const categoryFormMatrix: Record<CategoryFormMode, Record<string, CaterogyFieldMode>> = {
    insert: {
        type: 'edit',
        name: 'edit',
        category_group: 'edit',
        is_active: 'hidden'
    },

    update: {
        type: 'read',
        name: 'edit',
        category_group: 'edit',
        is_active: 'hidden'
    },

    delete: {
        type: 'hidden',
        name: 'read',
        category_group: 'hidden',
        is_active: 'hidden'
    },

    status: {
        type: 'hidden',
        name: 'read',
        category_group: 'hidden',
        is_active: 'edit'
    }
}
