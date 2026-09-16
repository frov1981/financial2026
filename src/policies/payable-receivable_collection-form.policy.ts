import { ReceivableCollectionFormMatrix } from "../types/form-view-params";

export const receivableCollectionFormMatrix: ReceivableCollectionFormMatrix = {

  insert: {
    account_id: 'editable',
    category_id: 'editable',
    principal_collected: 'editable',
    interest_collected: 'editable',
    collection_date: 'editable',
    note: 'editable'
  },

  update: {
    account_id: 'readonly',
    category_id: 'editable',
    principal_collected: 'editable',
    interest_collected: 'editable',
    collection_date: 'editable',
    note: 'editable'
  },

  delete: {
    account_id: 'readonly',
    category_id: 'readonly',
    principal_collected: 'readonly',
    interest_collected: 'readonly',
    collection_date: 'readonly',
    note: 'readonly'
  }

}