import { AuthRequest } from "./auth-request"

export type AccountFormMode = 'insert' | 'update' | 'delete'
export type AccountFieldPolicy = 'editable' | 'readonly' | 'hidden'
type AccountFieldMatrix = Record<string, AccountFieldPolicy>
type AccountFormMatrix = Record<AccountFormMode, AccountFieldMatrix>

export type CaterogyFieldMode = 'hidden' | 'readonly' | 'editable'
export type CategoryFormMode = 'insert' | 'update' | 'delete'
type CategoryFieldMatrix = Record<string, CaterogyFieldMode>
type CategoryFormMatrix = Record<CategoryFormMode, CategoryFieldMatrix>

export type CategoryGroupFieldMode = 'hidden' | 'readonly' | 'editable'
export type CategoryGroupFormMode = 'insert' | 'update' | 'delete'
type CategoryGroupFieldMatrix = Record<string, CategoryGroupFieldMode>
type CategoryGroupFormMatrix = Record<CategoryGroupFormMode, CategoryGroupFieldMatrix>

export type PayableFieldMode = 'hidden' | 'readonly' | 'editable'
export type PayableFormMode = 'insert' | 'update' | 'delete'
type PayableFieldMatrix = Record<string, PayableFieldMode>
type PayableFormMatrix = Record<PayableFormMode, PayableFieldMatrix>

export type PayableGroupFieldMode = 'hidden' | 'readonly' | 'editable'
export type PayableGroupFormMode = 'insert' | 'update' | 'delete'
type PayableGroupFieldMatrix = Record<string, PayableGroupFieldMode>
type PayableGroupFormMatrix = Record<PayableGroupFormMode, PayableGroupFieldMatrix>

export type PayablePaymentFieldMode = 'hidden' | 'readonly' | 'editable'
export type PayablePaymentFormMode = 'insert' | 'update' | 'delete'
type PayablePaymentFieldMatrix = Record<string, PayablePaymentFieldMode>
type PayablePaymentFormMatrix = Record<PayablePaymentFormMode, PayablePaymentFieldMatrix>

export type TransactionFieldMode = 'hidden' | 'readonly' | 'editable'
export type TransactionFormMode = 'insert' | 'update' | 'delete'
type TransactionFieldMatrix = Record<string, TransactionFieldMode>
type TransactionFormMatrix = Record<TransactionFormMode, TransactionFieldMatrix>

export type ReceivableGroupFieldMode = 'hidden' | 'readonly' | 'editable'
export type ReceivableGroupFormMode = 'insert' | 'update' | 'delete'
type ReceivableGroupFieldMatrix = Record<string, ReceivableGroupFieldMode>
type ReceivableGroupFormMatrix = Record<ReceivableGroupFormMode, ReceivableGroupFieldMatrix>

export type BaseFormViewParams = {
    title: string
    view: string
    errors: any
    mode: 'insert' | 'update' | 'delete'
    auth_req: AuthRequest
}