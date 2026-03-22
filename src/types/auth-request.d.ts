import { Request } from 'express'
import { RoleUser } from '../policies/roles-user.policy'

/* Usuario seguro para sesión (no depende de la entidad) */
export interface SessionUser {
  id: number
  email: string
  name: string
  created_at: Date
}


export interface AuthRequest extends Request {
  user: SessionUser
  timezone?: string
  role?: RoleUser
}