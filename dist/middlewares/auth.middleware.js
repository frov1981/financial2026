"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const datasource_1 = require("../config/datasource");
const User_entity_1 = require("../entities/User.entity");
const authMiddleware = async (req, res, next) => {
    try {
        const userRepo = datasource_1.AppDataSource.getRepository(User_entity_1.User);
        // ==================================================
        // DESARROLLO: usuario por defecto si no hay header
        // ==================================================
        if (process.env.NODE_ENV === 'development' &&
            !req.headers['x-user-id']) {
            const devUserId = Number(process.env.DEV_USER_ID || 1);
            const devUser = await userRepo.findOneBy({ id: devUserId });
            if (!devUser) {
                return res
                    .status(500)
                    .json({ error: 'DEV_USER_ID no existe en la base de datos' });
            }
            ;
            req.user = devUser;
            return next();
        }
        // ==================================================
        // PRODUCCIÓN / CASO NORMAL
        // ==================================================
        const userIdHeader = req.headers['x-user-id'];
        if (!userIdHeader) {
            return res.status(401).json({ error: 'No autorizado' });
        }
        const userId = Number(userIdHeader);
        if (Number.isNaN(userId)) {
            return res.status(400).json({ error: 'x-user-id inválido' });
        }
        const user = await userRepo.findOneBy({ id: userId });
        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }
        ;
        req.user = user;
        next();
    }
    catch (error) {
        console.error('authMiddleware error:', error);
        res.status(500).json({ error: 'Error interno de autenticación' });
    }
};
exports.authMiddleware = authMiddleware;
