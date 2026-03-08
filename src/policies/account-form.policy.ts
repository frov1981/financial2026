import { AccountFormMatrix } from "../types/form-view-params";

export const accountFormMatrix: AccountFormMatrix = {
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
        type: 'read',
        name: 'read',
        is_active: 'read'
    }
}
