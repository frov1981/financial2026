import { LOGGER_EVENTS } from '../utils/logger-events'
import nodemailer from 'nodemailer'
import { User } from '../entities/User.entity'
import { parseError } from '../utils/error.util'
import { logger as root_logger } from '../utils/logger.util'

import { buildWeeklyBalanceMail } from './weekly-balance-mail.service'

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: process.env.MAIL_SECURE === 'true',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
})

export async function sendWeeklyBalanceMail(user: User, timezone = 'UTC'): Promise<void> {
  const weekly_balance_mail_logger = root_logger.forMethod('sendWeeklyBalanceMail', LOGGER_EVENTS.MAIL, user.id)
  const started_at = performance.now()

  try {
    const mail = await buildWeeklyBalanceMail(user, timezone)

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: user.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: [{
        filename: 'balances-todos.png',
        content: mail.chart,
        cid: 'weekly-balances-chart',
      }],
    })

    weekly_balance_mail_logger.info(`[MAIL] Resumen semanal enviado a [${user.email}]`)
  } catch (error) {
    weekly_balance_mail_logger.error(`[MAIL] Error enviando resumen semanal a [${user.email}]`, parseError(error))
    throw error
  } finally {
    const ended_at = performance.now()
    const elapsed_ms = ended_at - started_at
    weekly_balance_mail_logger.elapsedTime('Elapsed time', { elapsed_ms })
    weekly_balance_mail_logger.debug('Fin de la operación de envío de resumen semanal')
  } 
}