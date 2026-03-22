type Role = 'ADMIN' | 'USER'

export interface RoleUser {
    can_update_amount_loan?: boolean
    can_update_start_date_loan?: boolean
    can_update_date_payment?: boolean
    can_update_date_transaction?: boolean
    can_delete_transaction?: boolean
}

export const role_permissions: Record<Role, RoleUser> = {
    ADMIN: {
        can_update_amount_loan: true,
        can_update_start_date_loan: true,
        can_update_date_payment: true,
        can_update_date_transaction: true,
        can_delete_transaction: true,
    },
    USER: {
        can_update_amount_loan: false,
        can_update_start_date_loan: false,
        can_update_date_payment: false,
        can_update_date_transaction: false,
        can_delete_transaction: false,
    }
}