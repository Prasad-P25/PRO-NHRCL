"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.AppError = void 0;
const logger_1 = require("../utils/logger");
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const errorHandler = (err, req, res, next) => {
    let statusCode = 500;
    let message = 'Internal server error';
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    }
    logger_1.logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    if (process.env.NODE_ENV === 'development') {
        logger_1.logger.error(err.stack);
    }
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(statusCode).json({
        success: false,
        message,
        ...(isDevelopment ? { stack: err.stack } : {}),
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map