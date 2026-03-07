import session from 'express-session'
import MySQLStoreFactory from 'express-mysql-session'
import mysql from 'mysql2/promise'

const MySQLStore = MySQLStoreFactory(session)

/* ============================
   Pool MySQL para sesiones
============================ */
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z',
  // limitar el número de conexiones dedicadas a sesiones. Si el servidor MySQL
  // impone `max_user_connections` bajo (por ejemplo 5) debemos sumar los
  // límites de ambas pools y quedarnos por debajo. 1 o 2 suele ser suficiente
  // para la mayoría de apps.
  connectionLimit: process.env.SESSION_DB_CONNECTION_LIMIT ? parseInt(process.env.SESSION_DB_CONNECTION_LIMIT, 10) : 1
})

/* ============================
   Store de sesiones
============================ */
export const sessionStore = new MySQLStore(
  {
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 60 * 60 * 1000,
    createDatabaseTable: true,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  },
  pool as any
)
