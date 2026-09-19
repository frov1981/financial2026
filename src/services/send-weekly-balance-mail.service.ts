import nodemailer from 'nodemailer'
import { User } from '../entities/User.entity'
import { parseError } from '../utils/error.util'
import { logger } from '../utils/logger.util'
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

    logger.info(`[MAIL] Resumen semanal enviado a [${user.email}]`)
  } catch (error) {
    logger.error(`[MAIL] Error enviando resumen semanal a [${user.email}]`, parseError(error))
    throw error
  }
}