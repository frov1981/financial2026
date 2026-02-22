import nodemailer from 'nodemailer'
import { logger } from '../utils/logger.util'

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: process.env.MAIL_SECURE === 'true',
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
})

export async function send2FACodeMail(to: string, name: string, code: string): Promise<void> {
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
        logger.error('[MAIL] Error enviando correo 2FA', error)
        throw error
    }
}
