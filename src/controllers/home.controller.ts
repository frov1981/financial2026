import { Request, Response } from 'express'

// Endpoint para renderizar la página EJS
export const homePage = (req: Request, res: Response) => {
    res.render('layouts/main', {
        title: 'Inicio',
        view: 'pages/home'
    })
}

