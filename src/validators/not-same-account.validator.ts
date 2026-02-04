import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments
} from 'class-validator'
import { Transaction } from '../entities/Transaction.entity'

@ValidatorConstraint({ name: 'NotSameAccount', async: false })
export class NotSameAccount implements ValidatorConstraintInterface {

    validate(_: any, args: ValidationArguments): boolean {
        const t = args.object as Transaction

        if (t.type !== 'transfer') return true

        if (!t.account || !t.to_account) return true

        return t.account.id !== t.to_account.id
    }

    defaultMessage(): string {
        return 'La cuenta origen y la cuenta destino no pueden ser la misma'
    }
}
