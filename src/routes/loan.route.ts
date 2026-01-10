import { Router } from "express"
import { deleteLoanFormPage, insertLoanFormPage, loansPage, updateLoanFormPage } from "../controllers/loan/loan.controller"
import { saveLoan } from "../controllers/loan/loan.controller.saving"
import { paymentsPage } from "../controllers/payment/payment.controller"

const router = Router()

router.get('/', loansPage)
router.get('/insert', insertLoanFormPage)
router.get('/update/:id', updateLoanFormPage)
router.get('/delete/:id', deleteLoanFormPage)
router.post('/', saveLoan)

router.get('/:id', paymentsPage)

export default router