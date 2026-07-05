import { AppDataSource } from "../config/typeorm.datasource"
import { PayablePayment } from "../entities/PayablePayment.entity"

/* =========================================================
Obtener siguiente número de pago para un Cuentas por Pagar
========================================================= */

export const getNextPayablePaymentNumber = async (payable_id: number): Promise<number> => {

  const last_payment = await AppDataSource
    .getRepository(PayablePayment)
    .createQueryBuilder('p')
    .where('p.payable_id = :payable_id', { payable_id })
    .andWhere('p.payment_number > 0')
    .orderBy('p.payment_number', 'DESC')
    .getOne()

  if (!last_payment?.payment_number) return 1

  return last_payment.payment_number + 1
}