import { PaymentFormMatrix } from "../types/form-view-params";

export const paymentFormMatrix: PaymentFormMatrix = {

  insert: {
    account_id: 'editable',
    category_id: 'editable',
    principal_paid: 'editable',
    interest_paid: 'editable',
    payment_date: 'editable',
    note: 'editable'
  },

  update: {
    account_id: 'readonly',
    category_id: 'editable',
    principal_paid: 'editable',
    interest_paid: 'editable',
    payment_date: 'editable',
    note: 'editable'
  },

  delete: {
    account_id: 'readonly',
    category_id: 'readonly',
    principal_paid: 'readonly',
    interest_paid: 'readonly',
    payment_date: 'readonly',
    note: 'readonly'
  }

}