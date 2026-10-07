import { SupplierFormMatrix } from '../types/form-view-params'

export const supplierFormMatrix: SupplierFormMatrix = {
  insert: {
    business_name: 'editable',
    tax_id: 'editable',
    address_1: 'editable',
    address_2: 'editable',
    mobile_1: 'editable',
    mobile_2: 'editable',
    whatsapp_1: 'editable',
    whatsapp_2: 'editable',
    email_1: 'editable',
    email_2: 'editable',
    is_active: 'readonly'
  },
  update: {
    business_name: 'editable',
    tax_id: 'editable',
    address_1: 'editable',
    address_2: 'editable',
    mobile_1: 'editable',
    mobile_2: 'editable',
    whatsapp_1: 'editable',
    whatsapp_2: 'editable',
    email_1: 'editable',
    email_2: 'editable',
    is_active: 'editable'
  },
  delete: {
    business_name: 'readonly',
    tax_id: 'readonly',
    address_1: 'readonly',
    address_2: 'readonly',
    mobile_1: 'readonly',
    mobile_2: 'readonly',
    whatsapp_1: 'readonly',
    whatsapp_2: 'readonly',
    email_1: 'readonly',
    email_2: 'readonly',
    is_active: 'readonly'
  }
}
