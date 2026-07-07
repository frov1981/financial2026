import { DateTime } from "luxon"
import { AppDataSource } from "../config/typeorm.datasource"
import { Transaction } from "../entities/Transaction.entity"
import { AuthRequest } from "../types/auth-request"

export const getNextValidTransactionDate = async (auth_req: AuthRequest): Promise<Date> => {

    const user_id = auth_req.user.id
    const timezone = auth_req.timezone ?? 'UTC'
    const now_utc = DateTime.utc()
    const now_local = now_utc.setZone(timezone)
    const start_of_day_utc = now_local.startOf('day').toUTC().toJSDate()
    const end_of_day_utc = now_local.endOf('day').toUTC().toJSDate()

    const last_transaction = await AppDataSource
        .getRepository(Transaction)
        .createQueryBuilder('t')
        .where('t.user_id = :user_id', { user_id })
        .andWhere('t.date BETWEEN :start AND :end', { start: start_of_day_utc, end: end_of_day_utc })
        .orderBy('t.date', 'DESC')
        .getOne()

    if (!last_transaction?.date) return now_utc.toJSDate()

    const last_transaction_utc = DateTime.fromJSDate(last_transaction.date, { zone: 'utc' })
    const remainder = last_transaction_utc.minute % 5
    const increment = remainder === 0 ? 5 : 5 - remainder
    const next_valid_utc = last_transaction_utc.plus({ minutes: increment }).set({ second: 0, millisecond: 0 })
    
    if (next_valid_utc < now_utc) return now_utc.set({ second: 0, millisecond: 0 }).toJSDate()

    return next_valid_utc.toJSDate()
}
