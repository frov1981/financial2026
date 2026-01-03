import express from 'express'
import path from 'path'

import { authMiddleware } from './middlewares/auth.middleware'
import { httpLogger } from './middlewares/logger.middleware'

import indexRoutes from './routes/index.route'
import accountRoutes from './routes/account.route'
import categoryRoutes from './routes/category.route'
import transactionRoutes from './routes/transaction.route'
import apiRoutes from './routes/api.route'

export const app = express()

/* =======================
   Middlewares base
======================= */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(httpLogger)

/* =======================
   View engine
======================= */
app.set('view engine', 'ejs')
app.set('views', path.join(process.cwd(), 'src/views'))
app.use(express.static(path.join(process.cwd(), 'src/public')))

/* =======================
   Auth global
======================= */
app.use(authMiddleware)

/* =======================
   Variables globales EJS
======================= */
app.use((req, res, next) => {
    res.locals.errors = {}
    next()
})

/* =======================
   Routes
======================= */
app.use('/', indexRoutes)
app.use('/accounts', accountRoutes)
app.use('/categories', categoryRoutes)
app.use('/transactions', transactionRoutes)
app.use('/api', apiRoutes)
