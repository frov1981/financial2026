import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getActiveCategoryById } from '../../cache/cache-categories.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { ReceivableCollection } from '../../entities/ReceivableCollection.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateSaveReceivableCollection = async (auth_req: AuthRequest, receivableCollection: ReceivableCollection, old_receivableCollection: ReceivableCollection | null): Promise<Record<string, string> | null> => {
    const receivableCollection_instance = plainToInstance(ReceivableCollection, receivableCollection)
    const errors = await validate(receivableCollection_instance)
    const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}

    const receivableCollection_repo = AppDataSource.getRepository(ReceivableCollection)
    // Validación monto principal
    let available_amount = receivableCollection.receivable.balance
    if (old_receivableCollection) available_amount += old_receivableCollection.principal_collected
    if (receivableCollection.principal_collected > available_amount) {
        field_errors.principal_collected = 'El monto del capital supera el saldo pendiente de la cuenta por pagar'
    }
    const total_receivableCollection = receivableCollection.principal_collected + receivableCollection.interest_collected
    if (total_receivableCollection <= 0) {
        field_errors.general = 'El monto total del pago (capital + intereses) debe ser mayor a cero'
    }
    // Detectar cambios contables
    let financial_change = false
    if (old_receivableCollection) {
        const principal_changed = receivableCollection.principal_collected !== old_receivableCollection.principal_collected
        const interest_changed = receivableCollection.interest_collected !== old_receivableCollection.interest_collected
        const new_date = receivableCollection.collection_date.getTime()
        const old_date = new Date(old_receivableCollection.collection_date).getTime()
        const date_changed = new_date !== old_date
        financial_change = principal_changed || interest_changed || date_changed
    }
    if (old_receivableCollection && financial_change) {
        const now = new Date()
        const receivableCollection_date = new Date(old_receivableCollection.collection_date)
        const same_month = receivableCollection_date.getFullYear() === now.getFullYear() && receivableCollection_date.getMonth() === now.getMonth()
        /*if (!same_month) {
            if (!auth_req.role?.can_update_date_receivableCollection) {
                field_errors.general = 'No se pueden modificar monto o fecha de pagos de meses anteriores'
            }
        }*/
    }
    // Validación categoría
    if (receivableCollection.category && receivableCollection.category.id) {
        const category = await getActiveCategoryById(auth_req, receivableCollection.category.id)
        if (!category) {
            field_errors.category = 'La categoría seleccionada no es válida'
        }
    }
    // Validación fecha del pago
    //const last_receivableCollection = await receivableCollection_repo.findOne({ where: { payable: { id: receivableCollection.payable.id } }, order: { receivableCollection_date: 'DESC', id: 'DESC' } })
    /*if (last_receivableCollection && (!old_receivableCollection || last_receivableCollection.id !== old_receivableCollection.id) && receivableCollection.receivableCollection_date.getTime() < last_receivableCollection.receivableCollection_date.getTime()) {
        if (!auth_req.role?.can_update_date_receivableCollection) {
            field_errors.receivableCollection_date = 'La fecha del pago no puede ser anterior al último pago registrado'
        }
    }*/
    return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteReceivableCollection = async (auth_req: AuthRequest, receivableCollection: ReceivableCollection): Promise<Record<string, string> | null> => {
    const field_errors: Record<string, string> = {}
    const now = new Date()
    //const receivableCollection_date = new Date(receivableCollection.receivableCollection_date)
    // Validación mismo mes
    //const same_month = receivableCollection_date.getFullYear() === now.getFullYear() && receivableCollection_date.getMonth() === now.getMonth()
    /*if (!same_month) {
        if (!auth_req.role?.can_update_date_receivableCollection) {
            field_errors.general = 'Solo se pueden eliminar pagos del mes en curso'
        }
    }*/
    // Validación último pago
    const receivableCollection_repo = AppDataSource.getRepository(ReceivableCollection)
    /*const last_receivableCollection = await receivableCollection_repo.findOne({
        where: { payable: { id: receivableCollection.payable.id } },
        order: { receivableCollection_date: 'DESC', id: 'DESC' }
    })*/
    /*if (!last_receivableCollection || last_receivableCollection.id !== receivableCollection.id) {
        field_errors.general = 'Solo se puede eliminar el último pago registrado de la cuenta por pagar'
    }*/
    return Object.keys(field_errors).length > 0 ? field_errors : null
}