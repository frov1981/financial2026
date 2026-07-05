import { PayableGroupFormMatrix } from "../types/form-view-params"

export const payableGroupFormMatrix: PayableGroupFormMatrix = {
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
