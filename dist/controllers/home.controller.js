"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.homePage = void 0;
// Endpoint para renderizar la página EJS
const homePage = (req, res) => {
    res.render('layouts/main', {
        title: 'Inicio',
        view: 'pages/home'
    });
};
exports.homePage = homePage;
