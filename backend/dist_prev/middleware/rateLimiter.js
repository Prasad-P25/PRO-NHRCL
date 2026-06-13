"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = require("../utils/logger");
// General API rate limiter - 100 requests per minute
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: {
        success: false,
        message: 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logger_1.logger.warn(`Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
        res.status(429).json(options.message);
    },
});
// Strict rate limiter for auth routes - 5 attempts per minute
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: {
        success: false,
        message: 'Too many login attempts, please try again after 1 minute.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logger_1.logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json(options.message);
    },
});
// File upload rate limiter - 10 uploads per minute
exports.uploadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: {
        success: false,
        message: 'Too many file uploads, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logger_1.logger.warn(`Upload rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json(options.message);
    },
});
//# sourceMappingURL=rateLimiter.js.map