import { Router } from 'express'
import {
  apiForSavingNotificationSchedule,
  routeToNotificationScheduleForm,
  routeToNotificationsPage
} from '../controllers/notification/notification.controller'

const router = Router()

router.get('/', routeToNotificationsPage)
router.get('/schedule', routeToNotificationScheduleForm)
router.post('/schedule', apiForSavingNotificationSchedule)

export default router