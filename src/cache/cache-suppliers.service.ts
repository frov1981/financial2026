import { LOGGER_EVENTS } from '../utils/logger-events'
import { performance } from 'perf_hooks'
import { AppDataSource } from '../config/typeorm.datasource'
import type { DTOSupplier, DTOSuppliersResponse } from '../dto/dto'
import { Supplier } from '../entities/Supplier.entity'
import { SupplierGroup } from '../entities/SupplierGroup.entity'
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
    relations: { supplier_group: true },
    order: { business_name: 'ASC' }
  })
  cache.set(cache_key, suppliers)
  return suppliers
}

export const getSuppliers = async (auth_req: AuthRequest): Promise<Supplier[]> => {
  return getSuppliersBase(auth_req.user.id)
}

export const getSupplierIdentityList = async (
  auth_req: AuthRequest
): Promise<Array<{ id: number; business_name: string; tax_id: string | null }>> => {
  const suppliers = await getSuppliers(auth_req)
  return suppliers.map(({ id, business_name, tax_id }) => ({ id, business_name, tax_id }))
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

export const getSupplierByBusinessName = async (
  auth_req: AuthRequest,
  business_name: string,
  excluded_supplier_id?: number
): Promise<Supplier | null> => {
  const suppliers = await getSuppliersBase(auth_req.user.id)
  const normalized_name = business_name.trim().toLowerCase()
  return suppliers.find(supplier =>
    supplier.business_name.trim().toLowerCase() === normalized_name &&
    supplier.id !== excluded_supplier_id
  ) || null
}

export const getSupplierGroupsBase = async (user_id: number): Promise<SupplierGroup[]> => {
  const cache_key = cacheKeys.supplierGroupByUser(user_id)
  const cached_groups = cache.get<SupplierGroup[]>(cache_key)
  if (cached_groups !== undefined) return cached_groups

  const groups = await AppDataSource.getRepository(SupplierGroup).find({
    where: { user: { id: user_id } },
    order: { name: 'ASC' }
  })
  cache.set(cache_key, groups)
  return groups
}

export const getSupplierGroups = async (auth_req: AuthRequest): Promise<SupplierGroup[]> => {
  return getSupplierGroupsBase(auth_req.user.id)
}

export const getSupplierGroupById = async (auth_req: AuthRequest, group_id: number): Promise<SupplierGroup | null> => {
  const groups = await getSupplierGroupsBase(auth_req.user.id)
  return groups.find(group => group.id === group_id) || null
}

export const getSupplierGroupByName = async (auth_req: AuthRequest, name: string): Promise<SupplierGroup | null> => {
  const groups = await getSupplierGroupsBase(auth_req.user.id)
  const normalized_name = name.trim().toLocaleLowerCase()
  return groups.find(group => group.name.trim().toLocaleLowerCase() === normalized_name) || null
}

export const getActiveSupplierGroupsIncludeCurrent = async (
  auth_req: AuthRequest,
  group_id?: number
): Promise<SupplierGroup[]> => {
  const groups = await getSupplierGroupsBase(auth_req.user.id)
  return groups.filter(group => group.is_active || group.id === group_id)
}

export const getSuppliersForApi = async (auth_req: AuthRequest): Promise<DTOSuppliersResponse> => {
  const user_id = auth_req.user.id
  const cache_key = cacheKeys.suppliersByUserForApi(user_id)
  const cached_suppliers = cache.get<DTOSupplier[]>(cache_key)
  if (cached_suppliers !== undefined) return { suppliers: cached_suppliers, metadata: { source: 'cache', number_of_rows: cached_suppliers.length } }

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
    supplier_group: {
      id: supplier.supplier_group.id,
      name: supplier.supplier_group.name,
      is_active: supplier.supplier_group.is_active
    },
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
  return { suppliers: result, metadata: { source: 'database', number_of_rows: result.length } }
}
