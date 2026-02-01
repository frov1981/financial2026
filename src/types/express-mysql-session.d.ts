declare module 'express-mysql-session' {
  import session from 'express-session'

  function MySQLStoreFactory(session: typeof import('express-session')): any

  export = MySQLStoreFactory
}
