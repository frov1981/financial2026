export type CaterogyGroupFieldMode = 'hidden' | 'read' | 'edit'
export type CategoryGroupFormMode = 'insert' | 'update' | 'delete'

export const categoryGroupFormMatrix: Record<CategoryGroupFormMode, Record<string, CaterogyGroupFieldMode>> = {
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
