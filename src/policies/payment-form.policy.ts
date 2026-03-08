import { PaymentFormMatrix } from "../types/form-view-params";

export const paymentFormMatrix: PaymentFormMatrix = {

  insert: {
    account_id: 'edit',
    category_id: 'edit',
    principal_paid: 'edit',
    interest_paid: 'edit',
    payment_date: 'edit',
    note: 'edit'
  },

  update: {
    account_id: 'read',
    category_id: 'edit',
    principal_paid: 'edit',
    interest_paid: 'edit',
    payment_date: 'edit',
    note: 'edit'
  },

  delete: {
    account_id: 'read',
    category_id: 'read',
    principal_paid: 'read',
    interest_paid: 'read',
    payment_date: 'read',
    note: 'read'
  }

}