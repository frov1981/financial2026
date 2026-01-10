import { Router } from 'express'
import { deletePaymentFormPage, insertPaymentFormPage, paymentsPage, updatePaymentFormPage } from '../controllers/payment/payment.controller'
import { savePayment } from '../controllers/payment/payment.controller.saving'

const router = Router()

router.get('/:id', paymentsPage)
router.get('/insert/:loanId', insertPaymentFormPage)
router.get('/update/:id', updatePaymentFormPage)
router.get('/delete/:id', deletePaymentFormPage)
router.post('/', savePayment)

export default router
