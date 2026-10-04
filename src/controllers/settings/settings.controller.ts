import { LOGGER_EVENTS } from '../../utils/logger-events'
import { RequestHandler } from 'express'
import { AuthRequest } from '../../types/auth-request'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'

export const routeToSettingsPage: RequestHandler = (req, res, next) => {
  const auth_req = req as AuthRequest
  const settings_logger = logger.forMethod(routeToSettingsPage.name, LOGGER_EVENTS.SETTINGS, auth_req.user.id)
  const started_at = performance.now()
  settings_logger.debug('Inicio de carga de configuraciones', { user_id: auth_req.user.id })

  try {
    res.render('layouts/main', {
      title: 'Configuraciones',
      view: 'pages/settings/index',
      USER_ID: auth_req.user.id,
    })
    settings_logger.debug('Fin de carga de configuraciones', { user_id: auth_req.user.id })
  } catch (error) {
    settings_logger.error('Error cargando configuraciones', parseError(error))
    next(error)
  } finally {
    settings_logger.elapsedTime('Elapsed time', { elapsed_ms: performance.now() - started_at })
  }
}
