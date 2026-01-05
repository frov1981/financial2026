import { Router } from "express"
import { insertLoanFormPage, loansPage, updateLoanFormPage } from "../controllers/loan/loan.controller"
import { saveLoan } from "../controllers/loan/loan.controller.savinfg"

const router = Router()

router.get('/', loansPage)
router.get('/insert', insertLoanFormPage)
router.get('/update/:id', updateLoanFormPage)
router.post('/', saveLoan)

export default router