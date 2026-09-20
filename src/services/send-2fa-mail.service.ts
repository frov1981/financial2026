import nodemailer from 'nodemailer'
import { logger as root_logger } from '../utils/logger.util'

const send_2fa_mail_logger = root_logger.forMethod('send2FACodeByEmail', 'SEND_2FA_MAIL')
import { parseError } from '../utils/error.util'

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: process.env.MAIL_SECURE === 'true',
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
})

export async function send2FACodeMail(to: string, name: string, code: string): Promise<void> {
    const started_at = performance.now()
    try {
        await transporter.sendMail({
            from: process.env.MAIL_FROM,
            to,
            subject: 'Código de verificación (2FA)',
            text: `Hola ${name}, tu código de verificación es: ${code}`,
            html: `
        <p>Hola <strong>${name}</strong>,</p>
        <p>Tu código de verificación es:</p>
        <h2>${code}</h2>
        <p>Este código expira en 10 minutos.</p>
        <p>Favor no responder a este correo.</p>
      `
        })
    } catch (error) {
        send_2fa_mail_logger.error('[MAIL] Error enviando correo 2FA', parseError(error))
        throw error
    } finally {
        const ended_at = performance.now()
        const elapsed_ms = ended_at - started_at
        send_2fa_mail_logger.elapsedTime('Elapsed time', { elapsed_ms })
        send_2fa_mail_logger.debug('Fin de la operación de envío de correo 2FA')
    }
}
