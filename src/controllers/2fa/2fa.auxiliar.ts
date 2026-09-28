import { Request } from 'express'

export const saveSession = (req: Request): Promise<void> => new Promise((resolve, reject) => {
  req.session.save(error => {
    if (error) reject(error)
    else resolve()
  })
})

export const regenerateSession = (req: Request): Promise<void> => new Promise((resolve, reject) => {
  req.session.regenerate(error => {
    if (error) reject(error)
    else resolve()
  })
})