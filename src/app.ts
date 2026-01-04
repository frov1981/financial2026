import express, { Request, Response, NextFunction } from 'express'
import path from 'path'

import { authMiddleware } from './middlewares/auth.middleware'
import { httpLogger } from './middlewares/logger.middleware'

import indexRoutes from './routes/index.route'
import accountRoutes from './routes/account.route'
import categoryRoutes from './routes/category.route'
import transactionRoutes from './routes/transaction.route'
import apiRoutes from './routes/api.route'

export const app = express()

const isProd = process.env.NODE_ENV === 'production'

/* =======================
   Middlewares base
======================= */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(httpLogger)

/* =======================
   Views y estáticos
======================= */
app.set('view engine', 'ejs')

const viewsPath = isProd
  ? path.join(process.cwd(), 'dist/views')
  : path.join(process.cwd(), 'src/views')

const publicPath = isProd
  ? path.join(process.cwd(), 'dist/public')
  : path.join(process.cwd(), 'src/public')

app.set('views', viewsPath)
app.use(express.static(publicPath))

/* =======================
   Auth global
======================= */
app.use(authMiddleware)

/* =======================
   Variables globales EJS
======================= */
app.use((req: Request, res: Response, next: NextFunction) => {
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
