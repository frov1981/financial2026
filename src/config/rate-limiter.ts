import rateLimit from 'express-rate-limit'
import { Request, Response } from 'express'

/**
 * Handler personalizado para respuestas de rate limit en JSON
 */
const createJsonHandler = (message: string) => {
  return (req: Request, res: Response) => {
    const rateLimitData = (req as any).rateLimit
    const retryAfter = rateLimitData?.resetTime ? 
      Math.ceil((rateLimitData.resetTime - Date.now()) / 1000) : 60
    
    res.status(429).json({
      success: false,
      error: message,
      retryAfter, // segundos antes de reintentar
      resetTime: rateLimitData?.resetTime
    })
  }
}

/**
 * Rate limiter para login (5 intentos por 15 minutos)
 * Previene ataques de fuerza bruta en credenciales
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos máximo
  message: 'Demasiados intentos de login. Intenta nuevamente en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createJsonHandler('Demasiados intentos de login. Espera antes de intentar nuevamente.'),
  skip: (req) => {
    return process.env.NODE_SKIP_LOGIN === 'true'
  }
})

/**
 * Rate limiter para 2FA (5 intentos por 15 minutos)
 * Previene ataques de fuerza bruta en códigos de verificación
 */
export const twoFALimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos máximo
  message: 'Demasiados intentos de 2FA. Intenta nuevamente en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createJsonHandler('Demasiados intentos de 2FA. Espera antes de intentar nuevamente.'),
  skip: (req) => {
    return process.env.NODE_SKIP_LOGIN === 'true'
  }
})

/**
 * Rate limiter general para APIs (100 solicitudes por minuto)
 * Protege contra DOS en endpoints de lectura
 * Más permisivo que login/2FA para no afectar navegación normal
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 solicitudes máximo (suficiente para navegación)
  message: 'Demasiadas solicitudes. Espera antes de enviar más.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createJsonHandler('Límite de solicitudes excedido. Espera antes de intentar nuevamente.'),
  // Removido keyGenerator personalizado para usar el por defecto que maneja IPv6 correctamente
})
