declare module 'express-mysql-session' {

  function MySQLStoreFactory(session: typeof import('express-session')): any
  export = MySQLStoreFactory

}
