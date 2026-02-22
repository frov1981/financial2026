import { IsNull } from 'typeorm'
import { AppDataSource } from '../config/typeorm.datasource'
import { AuthCode } from '../entities/AuthCode.entity'
import { User } from '../entities/User.entity'
import { generateNumericCode, hashCode } from '../utils/auth-code.util'
import { logger } from '../utils/logger.util'
import { send2FACodeMail } from './send-2fa-mail.service'

export async function send2FACode(user: User): Promise<void> {
    const repo = AppDataSource.getRepository(AuthCode)

    await repo.delete({ user: { id: user.id }, used_at: IsNull() })

    const code = generateNumericCode(6)
    const codeHash = await hashCode(code)

    const expires = new Date()
    expires.setMinutes(expires.getMinutes() + 10)

    const authCode = repo.create({ user, code_hash: codeHash, expires_at: expires })

    await repo.save(authCode)
    await send2FACodeMail(user.email, user.name, code)
    logger.info(`[2FA] Código enviado por correo a [${user.email}], codigo: [${code}]`)
}
