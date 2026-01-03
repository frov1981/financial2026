import { Router } from 'express'
import { accountsPage, insertAccountFormPage, saveAccount, updateAccountFormPage, updateAccountStatusFormPage } from '../controllers/account.controller'

const router = Router()

router.get('/', accountsPage)
router.get('/insert', insertAccountFormPage)
router.get('/update/:id', updateAccountFormPage)
router.get('/status/:id', updateAccountStatusFormPage)
router.post('/', saveAccount)


export default router
