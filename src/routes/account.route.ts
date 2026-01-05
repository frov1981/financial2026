import { Router } from 'express'
import { accountsPage, deleteAccountFormPage, insertAccountFormPage, saveAccount, updateAccountFormPage, updateAccountStatusFormPage } from '../controllers/account/account.controller'

const router = Router()

router.get('/', accountsPage)
router.get('/insert', insertAccountFormPage)
router.get('/update/:id', updateAccountFormPage)
router.get('/delete/:id', deleteAccountFormPage)
router.get('/status/:id', updateAccountStatusFormPage)
router.post('/', saveAccount)

export default router
