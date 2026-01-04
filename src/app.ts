import express, { NextFunction, Request, Response } from 'express'
import session from 'express-session'
import path from 'path'
import { httpLogger } from './middlewares/logger.middleware'
import { sessionAuthMiddleware } from './middlewares/sessionAuth.middleware'
import accountRoutes from './routes/account.route'
import apiRoutes from './routes/api.route'
import authRoutes from './routes/auth.route'
import categoryRoutes from './routes/category.route'
import indexRoutes from './routes/index.route'
import transactionRoutes from './routes/transaction.route'

export const app = express()

const isProd = process.env.NODE_ENV === 'production'

/* =======================
   Middlewares base
======================= */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(httpLogger)

app.use(session({
   secret: process.env.SESSION_SECRET || 'nandoappsecret',
   resave: false,
   saveUninitialized: false,
   cookie: { maxAge: 1000 * 60 * 60 } // 1 hora
}))

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
//app.use(authMiddleware)

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
app.use('/', authRoutes)
app.use('/api', sessionAuthMiddleware, apiRoutes)
app.use('/accounts', sessionAuthMiddleware, accountRoutes)
app.use('/categories', sessionAuthMiddleware, categoryRoutes)
app.use('/transactions', sessionAuthMiddleware, transactionRoutes)
