import { CategoryFormMatrix } from "../types/form-view-params";

export const categoryFormMatrix: CategoryFormMatrix = {
    insert: {
        type: 'edit',
        type_for_loan: 'edit',
        name: 'edit', 
        category_group_id: 'edit',
        is_active: 'hidden'
    },

    update: {
        type: 'read',
        type_for_loan: 'edit',
        name: 'edit',
        category_group_id: 'edit',
        is_active: 'edit'
    },

    delete: {
        type: 'read',
        type_for_loan: 'read',
        name: 'read',
        category_group_id: 'read',
        is_active: 'read'
    }
}
