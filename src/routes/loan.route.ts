import { Router } from "express"
import { deleteLoanFormPage, insertLoanFormPage, loansPage, updateLoanFormPage } from "../controllers/loan/loan.controller"
import { saveLoan } from "../controllers/loan/loan.controller.saving"

const router = Router()

router.get('/', loansPage)
router.get('/insert', insertLoanFormPage)
router.get('/update/:id', updateLoanFormPage)
router.get('/delete/:id', deleteLoanFormPage)
router.post('/', saveLoan)

export default router