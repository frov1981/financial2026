import { Request } from 'express'

/* Usuario seguro para sesión (no depende de la entidad) */
export interface SessionUser {
  id: number
  email: string
  name: string
  roles: string
  created_at: Date
}

export interface AuthRequest extends Request {
  user: SessionUser
  timezone?: string
}