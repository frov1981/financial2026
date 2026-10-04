import { RequestHandler } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { DevicePreference } from '../../entities/DevicePreference.entity'
import { AuthRequest } from '../../types/auth-request'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'

const device_id_pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const max_state_bytes = 96 * 1024
const reserved_storage_keys = new Set(['app.device-id.v1', 'app.filter-keys.v1'])

const getDeviceId = (value: unknown): string | null => {
  if (typeof value !== 'string' || !device_id_pattern.test(value)) return null
  return value.toLowerCase()
}

export const getDevicePreferences: RequestHandler = async (req, res) => {
  const auth_req = req as AuthRequest
  const get_logger = logger.forMethod(getDevicePreferences.name, 'DEVICE_PREFERENCES', auth_req.user.id)
  const started_at = performance.now()
  const device_id = getDeviceId(req.query.device_id)
  let has_preferences = false
  get_logger.debug('Inicio de carga explícita de preferencias del dispositivo', {
    user_id: auth_req.user.id,
    device_id,
  })

  try {
    if (!device_id) return res.status(400).json({ error: 'Identificador de dispositivo inválido' })

    const preference = await AppDataSource.getRepository(DevicePreference).findOne({
      where: { user: { id: auth_req.user.id }, device_id },
    })
    has_preferences = preference !== null
    return res.json({
      state: preference?.state ?? null,
      updated_at: preference?.updated_at?.toISOString() ?? null,
    })
  } catch (error) {
    get_logger.error('Error leyendo preferencias del dispositivo', {
      user_id: auth_req.user.id,
      device_id,
      error: parseError(error),
    })
    return res.status(500).json({ error: 'No se pudieron cargar las preferencias del dispositivo' })
  } finally {
    get_logger.elapsedTime('Elapsed time', { elapsed_ms: performance.now() - started_at })
    get_logger.debug('Fin de carga explícita de preferencias del dispositivo', {
      user_id: auth_req.user.id,
      device_id,
      has_preferences,
      status_code: res.statusCode,
    })
  }
}

export const saveDevicePreferences: RequestHandler = async (req, res) => {
  const auth_req = req as AuthRequest
  const save_logger = logger.forMethod(saveDevicePreferences.name, 'DEVICE_PREFERENCES', auth_req.user.id)
  const started_at = performance.now()
  let device_id: string | null = null
  save_logger.debug('Inicio del guardado explícito de preferencias del dispositivo', { user_id: auth_req.user.id })

  try {
    device_id = getDeviceId(req.body?.device_id)
    const state = req.body?.state

    if (!device_id) return res.status(400).json({ error: 'Identificador de dispositivo inválido' })
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return res.status(400).json({ error: 'El estado de preferencias debe ser un objeto JSON' })
    }

    const filtered_state: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(state as Record<string, unknown>)) {
      if (!key || key.length > 256 || reserved_storage_keys.has(key)) {
        return res.status(400).json({ error: 'El estado contiene una clave de almacenamiento inválida' })
      }
      filtered_state[key] = value
    }

    let serialized_state: string
    try {
      serialized_state = JSON.stringify(filtered_state)
    } catch {
      return res.status(400).json({ error: 'El estado de preferencias no es serializable' })
    }

    const state_bytes = Buffer.byteLength(serialized_state, 'utf8')
    if (state_bytes > max_state_bytes) {
      return res.status(413).json({ error: 'El estado de preferencias supera el tamaño permitido' })
    }

    await AppDataSource.query(
      `INSERT INTO device_preferences (user_id, device_id, state)
       VALUES (?, ?, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE state = VALUES(state), updated_at = CURRENT_TIMESTAMP`,
      [auth_req.user.id, device_id, serialized_state],
    )
    save_logger.info('Preferencias del dispositivo guardadas correctamente', {
      user_id: auth_req.user.id,
      device_id,
      preference_count: Object.keys(filtered_state).length,
      state_bytes,
    })
    return res.json({ saved: true, csrfToken: req.session.csrfToken })
  } catch (error) {
    save_logger.error('Error guardando preferencias del dispositivo', {
      user_id: auth_req.user.id,
      device_id,
      error: parseError(error),
    })
    return res.status(500).json({ error: 'No se pudieron guardar las preferencias del dispositivo' })
  } finally {
    const elapsed_ms = performance.now() - started_at
    save_logger.elapsedTime('Elapsed time', { elapsed_ms })
    save_logger.debug('Fin del guardado explícito de preferencias del dispositivo', {
      user_id: auth_req.user.id,
      device_id,
      status_code: res.statusCode,
    })
  }
}
