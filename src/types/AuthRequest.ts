import { Request } from 'express'
import { User } from '../entities/User.entity'

export interface AuthRequest extends Request { 
  user: User
  timezone?: string
}
