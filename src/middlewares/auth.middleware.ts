import { RequestHandler } from 'express'
import { AppDataSource } from '../config/datasource'
import { User } from '../entities/User.entity'
import { AuthRequest } from '../types/AuthRequest'

export const authMiddleware: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const userRepo = AppDataSource.getRepository(User)

    // ==================================================
    // DESARROLLO: usuario por defecto si no hay header
    // ==================================================
    if (
      process.env.NODE_ENV === 'development' &&
      !req.headers['x-user-id']
    ) {
      const devUserId = Number(process.env.DEV_USER_ID || 1)

      const devUser = await userRepo.findOneBy({ id: devUserId })

      if (!devUser) {
        return res
          .status(500)
          .json({ error: 'DEV_USER_ID no existe en la base de datos' })
      }

      ;(req as AuthRequest).user = devUser
      return next()
    }

    // ==================================================
    // PRODUCCIÓN / CASO NORMAL
    // ==================================================
    const userIdHeader = req.headers['x-user-id']

    if (!userIdHeader) {
      return res.status(401).json({ error: 'No autorizado' })
    }

    const userId = Number(userIdHeader)

    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'x-user-id inválido' })
    }

    const user = await userRepo.findOneBy({ id: userId })

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' })
    }

    ;(req as AuthRequest).user = user

    next()
  } catch (error) {
    console.error('authMiddleware error:', error)
    res.status(500).json({ error: 'Error interno de autenticación' })
  }
}
