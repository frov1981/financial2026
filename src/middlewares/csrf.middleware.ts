import crypto from 'crypto'
import { Request, Response, NextFunction } from 'express'

/**
 * Genera un token CSRF único
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Middleware para generar y validar tokens CSRF
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Generar token si no existe en la sesión
  const session = req.session as any
  if (!session.csrfToken) {
    session.csrfToken = generateCSRFToken()
  }

  // Para métodos que modifican datos (POST, PUT, DELETE, PATCH)
  const modifyingMethods = ['POST', 'PUT', 'DELETE', 'PATCH']
  if (modifyingMethods.includes(req.method)) {
    // Excluir rutas de login y 2FA que no necesitan CSRF (manejan su propia protección)
    const excludedPaths = ['/login', '/2fa']
    if (excludedPaths.some(path => req.path.startsWith(path))) {
      return next()
    }

    const tokenFromBody = req.body?._csrf
    const tokenFromHeader = req.headers['x-csrf-token'] as string
    const sessionToken = session.csrfToken

    const providedToken = tokenFromBody || tokenFromHeader

    if (!providedToken || !sessionToken || providedToken !== sessionToken) {
      return res.status(403).json({
        success: false,
        error: 'Token CSRF inválido o faltante'
      })
    }

    // Rotar token después de uso exitoso
    session.csrfToken = generateCSRFToken()
  }

  // Agregar token a res.locals para que esté disponible en las vistas
  res.locals.csrfToken = session.csrfToken

  next()
}

/**
 * Middleware para agregar token CSRF a respuestas JSON
 */
export function csrfTokenMiddleware(req: Request, res: Response, next: NextFunction) {
  const session = req.session as any
  // Agregar helper para obtener token en respuestas JSON
  res.locals.getCSRFToken = () => session.csrfToken
  next()
}