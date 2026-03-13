import { AccountFormMatrix } from "../types/form-view-params";

export const accountFormMatrix: AccountFormMatrix = {
    insert: {
        type: 'editable',
        name: 'editable',
        is_active: 'readonly'
    },
    update: {
        type: 'readonly',
        name: 'editable',
        is_active: 'editable'
    },
    delete: {
        type: 'readonly',
        name: 'readonly',
        is_active: 'readonly'
    }
}
