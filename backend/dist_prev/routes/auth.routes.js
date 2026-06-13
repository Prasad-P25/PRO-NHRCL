"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
const authController = new auth_controller_1.AuthController();
// Login - strict rate limit (5 attempts per minute)
router.post('/login', rateLimiter_1.authLimiter, [
    (0, express_validator_1.body)('email').isEmail().withMessage('Please provide a valid email'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required'),
], authController.login);
router.post('/logout', auth_1.authenticate, authController.logout);
router.post('/refresh', authController.refreshToken);
// Forgot password - strict rate limit
router.post('/forgot-password', rateLimiter_1.authLimiter, [(0, express_validator_1.body)('email').isEmail().withMessage('Please provide a valid email')], authController.forgotPassword);
// Reset password - strict rate limit
router.post('/reset-password', rateLimiter_1.authLimiter, [
    (0, express_validator_1.body)('token').notEmpty().withMessage('Token is required'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
], authController.resetPassword);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map