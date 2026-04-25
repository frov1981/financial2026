import 'express-session'

declare module 'express-session' {
  interface SessionData {
    user_id?: number
    timezone?: string
    pending2FAUserId?: number
    csrfToken?: string
  }
  
}
