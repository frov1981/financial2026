import { TransactionFormMatrix } from "../types/form-view-params";

export const transactionFormMatrix: TransactionFormMatrix = {
    insert: {
        type: 'editable',
        account: 'editable',
        to_account: 'editable',
        category: 'editable',
        amount: 'editable',
        date: 'editable',
        description: 'editable'
    },
    update: {
        type: 'readonly',
        account: 'editable',
        to_account: 'editable',
        category: 'editable',
        amount: 'editable',
        date: 'editable',
        description: 'editable'
    },
    delete: {
        type: 'readonly',
        account: 'readonly',
        to_account: 'readonly',
        category: 'readonly',
        amount: 'readonly',
        date: 'readonly',
        description: 'readonly'
    },
}
