import { LOGGER_EVENTS } from '../utils/logger-events'
import { performance } from 'perf_hooks'
import { AppDataSource } from '../config/typeorm.datasource'
import type { DTOSupplier } from '../dto/dto'
import { Supplier } from '../entities/Supplier.entity'
import { AuthRequest } from '../types/auth-request'
import { logger as root_logger } from '../utils/logger.util'
import { cacheKeys } from './cache-key.service'
import { cache } from './cache.service'

const getSuppliersBase = async (user_id: number): Promise<Supplier[]> => {
  const cache_key = cacheKeys.suppliersByUser(user_id)
  const cached_suppliers = cache.get<Supplier[]>(cache_key)
  if (cached_suppliers !== undefined) return cached_suppliers

  const suppliers = await AppDataSource.getRepository(Supplier).find({
    where: { user: { id: user_id } },
    order: { business_name: 'ASC' }
  })
  cache.set(cache_key, suppliers)
  return suppliers
}

export const getSuppliers = async (auth_req: AuthRequest): Promise<Supplier[]> => {
  return getSuppliersBase(auth_req.user.id)
}

export const getSupplierById = async (auth_req: AuthRequest, supplier_id: number): Promise<Supplier | null> => {
  const suppliers = await getSuppliersBase(auth_req.user.id)
  return suppliers.find(supplier => supplier.id === supplier_id) || null
}

export const getActiveSuppliers = async (auth_req: AuthRequest): Promise<Supplier[]> => {
  const suppliers = await getSuppliersBase(auth_req.user.id)
  return suppliers.filter(supplier => supplier.is_active)
}

export const getActiveSuppliersIncludeCurrentSupplier = async (
  auth_req: AuthRequest,
  supplier_id?: number
): Promise<Supplier[]> => {
  const suppliers = await getSuppliersBase(auth_req.user.id)
  return suppliers.filter(supplier => supplier.is_active || supplier.id === supplier_id)
}

export const getSupplierByTaxId = async (auth_req: AuthRequest, tax_id: string): Promise<Supplier | null> => {
  const suppliers = await getSuppliersBase(auth_req.user.id)
  return suppliers.find(supplier => supplier.tax_id === tax_id) || null
}

export const getSuppliersForApi = async (auth_req: AuthRequest): Promise<DTOSupplier[]> => {
  const user_id = auth_req.user.id
  const cache_key = cacheKeys.suppliersByUserForApi(user_id)
  const cached_suppliers = cache.get<DTOSupplier[]>(cache_key)
  if (cached_suppliers !== undefined) return cached_suppliers

  const started_at = performance.now()
  const suppliers = await getSuppliersBase(user_id)
  const result: DTOSupplier[] = suppliers.map(supplier => ({
    id: supplier.id,
    business_name: supplier.business_name,
    tax_id: supplier.tax_id,
    address_1: supplier.address_1,
    address_2: supplier.address_2,
    mobile_1: supplier.mobile_1,
    mobile_2: supplier.mobile_2,
    whatsapp_1: supplier.whatsapp_1,
    whatsapp_2: supplier.whatsapp_2,
    email_1: supplier.email_1,
    email_2: supplier.email_2,
    is_active: supplier.is_active,
    created_at: supplier.created_at,
    updated_at: supplier.updated_at
  }))

  const elapsed_seconds = (performance.now() - started_at) / 1000
  const cache_logger = root_logger.forMethod(getSuppliersForApi.name, LOGGER_EVENTS.CACHE, user_id)
  cache_logger.debug(`method=[${getSuppliersForApi.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[supplier], count=[${result.length}], elapsedTime=[${elapsed_seconds.toFixed(4)}]`)
  cache.set(cache_key, result)
  return result
}
