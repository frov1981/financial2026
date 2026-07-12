import { ReceivableGroupFormMatrix } from "../types/form-view-params";

export const receivableGroupFormMatrix: ReceivableGroupFormMatrix = {
    insert: {
        name: 'editable',
        is_active: 'readonly'
    },
    update: {
        name: 'editable',
        is_active: 'readonly'
    },
    delete: {
        name: 'readonly',
        is_active: 'readonly'
    },
}
