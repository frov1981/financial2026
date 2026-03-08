import { AuthRequest } from "./auth-request"

export type PaymentFieldMode = 'hidden' | 'read' | 'edit'
export type PaymentFormMode = 'insert' | 'update' | 'delete'
type PaymentFieldMatrix = Record<string, PaymentFieldMode>
type PaymentFormMatrix = Record<PaymentFormMode, PaymentFieldMatrix>

export type LoanFieldMode = 'hidden' | 'read' | 'edit'
export type LoanFormMode = 'insert' | 'update' | 'delete'
type LoanFieldMatrix = Record<string, LoanFieldMode>
type LoanFormMatrix = Record<LoanFormMode, LoanFieldMatrix>

export type BaseFormViewParams = {
    title: string
    view: string
    errors: any
    mode: 'insert' | 'update' | 'delete'
    auth_req: AuthRequest
}