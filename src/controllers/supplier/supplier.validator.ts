import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getSupplierByTaxId } from '../../cache/cache-suppliers.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Supplier } from '../../entities/Supplier.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateSaveSupplier = async (auth_req: AuthRequest, supplier: Supplier): Promise<Record<string, string> | null> => {
  const errors = await validate(plainToInstance(Supplier, supplier))
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}

  if (supplier.tax_id) {
    const existing = await getSupplierByTaxId(auth_req, supplier.tax_id)

    if (existing && existing.id !== supplier.id) {
      field_errors.tax_id = 'Ya existe un proveedor con este RUC'
    }
  }

  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteSupplier = async (supplier: Supplier): Promise<Record<string, string> | null> => {
  const transaction_repo = AppDataSource.getRepository(Transaction)
  const used_in_transactions = await transaction_repo.existsBy({ supplier: { id: supplier.id } })
  if (used_in_transactions) {
    return { general: 'No se puede eliminar el proveedor porque tiene transacciones asociadas' }
  }
  return null
}
