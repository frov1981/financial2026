import { CategoryFormMatrix } from "../types/form-view-params";

export const categoryFormMatrix: CategoryFormMatrix = {
    insert: {
        type: 'editable',
        type_for_loan: 'editable',
        name: 'editable',
        category_group_id: 'editable',
        is_active: 'readonly'
    },
    update: {
        type: 'readonly',
        type_for_loan: 'editable',
        name: 'editable',
        category_group_id: 'editable',
        is_active: 'editable'
    },
    delete: {
        type: 'readonly',
        type_for_loan: 'readonly',
        name: 'readonly',
        category_group_id: 'readonly',
        is_active: 'readonly'
    }
}
