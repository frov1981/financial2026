"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
require("dotenv/config");
const app_1 = require("./app");
const datasource_1 = require("./config/datasource");
const logger_util_1 = require("./utils/logger.util");
const PORT = process.env.NODE_PORT ? parseInt(process.env.NODE_PORT, 10) : 3000;
datasource_1.AppDataSource.initialize().then(() => {
    app_1.app.listen(PORT, () => {
        logger_util_1.logger.info('Server started on port', { port: PORT });
    });
}).catch(error => {
    logger_util_1.logger.error('Error initializing data source', { error });
});
