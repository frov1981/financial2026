import express, { NextFunction, Request, Response } from 'express'
import session from 'express-session'
import path from 'path'
import { sessionStore } from './config/session-store'
import { injectLoanBalance } from './middlewares/inject-loan-balance.middleware'
import { injectNetBalance } from './middlewares/inject-net-balance.middleware'
import { httpLogger } from './middlewares/logger.middleware'
import { sessionAuthMiddleware } from './middlewares/session-auth.middleware'
import accountRoutes from './routes/account.route'
import authRoutes from './routes/auth.route'
import categoryRoutes from './routes/category.route'
import categoryGroupRoutes from './routes/category-group.route'
import homeRoutes from './routes/home.route'
import loanRoutes from './routes/loan.route'
import loanGroupRoutes from './routes/loan-group.route'
import paymentRoutes from './routes/payment.route'
import transactionRoutes from './routes/transaction.route'

export const app = express()
const isProd = process.env.NODE_ENV === 'production'

/* =======================
   Middlewares base
======================= */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(httpLogger)

/* =======================
   Sesiones (MySQL Store)
======================= */
app.set('trust proxy', 1)
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'nandoappsecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60,
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax'
  }
}))

/* =======================
   Views y estáticos
======================= */
app.set('view engine', 'ejs')
const viewsPath = isProd ? path.join(process.cwd(), 'dist/views') : path.join(process.cwd(), 'src/views')
const publicPath = isProd ? path.join(process.cwd(), 'dist/public') : path.join(process.cwd(), 'src/public')
app.set('views', viewsPath)
app.use(express.static(publicPath))

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
app.use('/', authRoutes)
app.use('/', homeRoutes)
const protectedRouter = express.Router()
protectedRouter.use(sessionAuthMiddleware)
protectedRouter.use(injectNetBalance)
protectedRouter.use('/accounts', accountRoutes)
protectedRouter.use('/categories', categoryRoutes)
protectedRouter.use('/category-groups', categoryGroupRoutes)
protectedRouter.use('/transactions', transactionRoutes)
protectedRouter.use('/loans', injectLoanBalance, loanRoutes)
protectedRouter.use('/loan-groups', loanGroupRoutes)
protectedRouter.use('/payments', injectLoanBalance, paymentRoutes)
app.use(protectedRouter)
