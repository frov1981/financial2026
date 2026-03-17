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

export type LoanFieldMode = 'hidden' | 'readonly' | 'editable'
export type LoanFormMode = 'insert' | 'update' | 'delete'
type LoanFieldMatrix = Record<string, LoanFieldMode>
type LoanFormMatrix = Record<LoanFormMode, LoanFieldMatrix>

export type LoanGroupFieldMode = 'hidden' | 'readonly' | 'editable'
export type LoanGroupFormMode = 'insert' | 'update' | 'delete'
type LoanGroupFieldMatrix = Record<string, LoanGroupFieldMode>
type LoanGroupFormMatrix = Record<LoanGroupFormMode, LoanGroupFieldMatrix>

export type PaymentFieldMode = 'hidden' | 'read' | 'edit'
export type PaymentFormMode = 'insert' | 'update' | 'delete'
type PaymentFieldMatrix = Record<string, PaymentFieldMode>
type PaymentFormMatrix = Record<PaymentFormMode, PaymentFieldMatrix>


export type BaseFormViewParams = {
    title: string
    view: string
    errors: any
    mode: 'insert' | 'update' | 'delete'
    auth_req: AuthRequest
}