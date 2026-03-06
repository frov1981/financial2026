import { AppDataSource } from "../config/typeorm.datasource"
import { LoanPayment } from "../entities/LoanPayment.entity"

/* =========================================================
Obtener siguiente número de pago para un préstamo
========================================================= */

export const getNextPaymentNumber = async (loan_id: number): Promise<number> => {

  const last_payment = await AppDataSource
    .getRepository(LoanPayment)
    .createQueryBuilder('p')
    .where('p.loan_id = :loan_id', { loan_id })
    .orderBy('p.payment_number', 'DESC')
    .getOne()

  if (!last_payment?.payment_number) return 1

  return last_payment.payment_number + 1
}