export type CaterogyFieldMode = 'hidden' | 'read' | 'edit'
export type CategoryFormMode = 'insert' | 'update' | 'delete' | 'status'
export type CategoryRole = 'parent' | 'child'

export const categoryFormMatrix: Record<CategoryFormMode, Record<CategoryRole, Record<string, CaterogyFieldMode>>> = {
    insert: {
        parent: {
            is_parent: 'hidden',
            type: 'hidden',
            name: 'edit',
            parent_name: 'hidden',
            is_active: 'hidden'
        },
        child: {
            is_parent: 'edit',
            type: 'edit',
            name: 'edit',
            parent_name: 'edit',
            is_active: 'hidden'
        }
    },
    update: {
        parent: {
            is_parent: 'hidden',
            type: 'hidden',
            name: 'edit',
            parent_name: 'hidden',
            is_active: 'hidden'
        },
        child: {
            is_parent: 'hidden',
            type: 'read',
            name: 'edit',
            parent_name: 'edit',
            is_active: 'hidden'
        }
    },
    delete: {
        parent: {
            is_parent: 'hidden',
            type: 'hidden',
            name: 'read',
            parent_name: 'hidden',
            is_active: 'hidden'
        },
        child: {
            is_parent: 'hidden',
            type: 'hidden',
            name: 'read',
            parent_name: 'hidden',
            is_active: 'hidden'
        }
    },
    status: {
        parent: {
            is_parent: 'hidden',
            type: 'hidden',
            name: 'read',
            parent_name: 'hidden',
            is_active: 'edit'
        },
        child: {
            is_parent: 'hidden',
            type: 'hidden',
            name: 'read',
            parent_name: 'hidden',
            is_active: 'edit'
        }
    }
}
