"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const express_validator_1 = require("express-validator");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const connection_1 = require("../database/connection");
const errorHandler_1 = require("../middleware/errorHandler");
const tokenBlacklist_1 = require("../utils/tokenBlacklist");
const logger_1 = require("../utils/logger");
const email_service_1 = require("../services/email.service");
class AuthController {
    constructor() {
        this.login = async (req, res, next) => {
            try {
                const errors = (0, express_validator_1.validationResult)(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, errors: errors.array() });
                }
                const { email, password } = req.body;
                const result = await connection_1.db.query(`SELECT u.*, r.name as role_name, r.permissions, p.code as package_code, p.name as package_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN packages p ON u.package_id = p.id
         WHERE u.email = $1`, [email]);
                if (result.rows.length === 0) {
                    throw new errorHandler_1.AppError('Invalid email or password', 401);
                }
                const user = result.rows[0];
                if (!user.is_active) {
                    throw new errorHandler_1.AppError('Account is inactive', 401);
                }
                const isValidPassword = await bcryptjs_1.default.compare(password, user.password_hash);
                if (!isValidPassword) {
                    throw new errorHandler_1.AppError('Invalid email or password', 401);
                }
                // Update last login
                await connection_1.db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
                const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET || 'default-secret', { expiresIn: (process.env.JWT_EXPIRES_IN || '24h') });
                res.json({
                    success: true,
                    data: {
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            role: {
                                id: user.role_id,
                                name: user.role_name,
                                permissions: user.permissions,
                            },
                            packageId: user.package_id,
                            package: user.package_id
                                ? {
                                    id: user.package_id,
                                    code: user.package_code,
                                    name: user.package_name,
                                }
                                : null,
                            isActive: user.is_active,
                            createdAt: user.created_at,
                        },
                        token,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.logout = async (req, res, next) => {
            try {
                // Extract token and add to blacklist
                const authHeader = req.headers.authorization;
                if (authHeader && authHeader.startsWith('Bearer ')) {
                    const token = authHeader.split(' ')[1];
                    // Blacklist token for 24 hours (same as JWT expiry)
                    tokenBlacklist_1.tokenBlacklist.add(token, 24 * 60 * 60 * 1000);
                    logger_1.logger.info(`Token blacklisted for user ${req.user?.id}`);
                }
                res.json({ success: true, message: 'Logged out successfully' });
            }
            catch (error) {
                next(error);
            }
        };
        this.refreshToken = async (req, res, next) => {
            try {
                const authHeader = req.headers.authorization;
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    throw new errorHandler_1.AppError('No token provided', 401);
                }
                const token = authHeader.split(' ')[1];
                // Check if old token is blacklisted
                if (tokenBlacklist_1.tokenBlacklist.isBlacklisted(token)) {
                    throw new errorHandler_1.AppError('Token has been revoked', 401);
                }
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'default-secret', { ignoreExpiration: true });
                // Blacklist the old token
                tokenBlacklist_1.tokenBlacklist.add(token, 24 * 60 * 60 * 1000);
                const newToken = jsonwebtoken_1.default.sign({ userId: decoded.userId }, process.env.JWT_SECRET || 'default-secret', { expiresIn: (process.env.JWT_EXPIRES_IN || '24h') });
                res.json({
                    success: true,
                    data: { token: newToken },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.forgotPassword = async (req, res, next) => {
            try {
                const errors = (0, express_validator_1.validationResult)(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, errors: errors.array() });
                }
                const { email } = req.body;
                const result = await connection_1.db.query('SELECT id, name FROM users WHERE email = $1 AND is_active = true', [email]);
                if (result.rows.length > 0) {
                    const user = result.rows[0];
                    // Generate secure reset token
                    const resetToken = crypto_1.default.randomBytes(32).toString('hex');
                    const resetTokenHash = crypto_1.default.createHash('sha256').update(resetToken).digest('hex');
                    // Token expires in 1 hour
                    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
                    // Save hashed token to database
                    await connection_1.db.query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [resetTokenHash, resetTokenExpires, user.id]);
                    // Generate reset URL
                    const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
                    logger_1.logger.info(`Password reset requested for ${email}`);
                    // Send password reset email (non-blocking to prevent timeout)
                    email_service_1.emailService.sendPasswordReset(email, {
                        name: user.name,
                        resetUrl,
                    }).catch(err => logger_1.logger.error('Failed to send password reset email:', err));
                }
                // Always return success to prevent email enumeration
                res.json({
                    success: true,
                    message: 'If the email exists, a password reset link has been sent',
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.resetPassword = async (req, res, next) => {
            try {
                const errors = (0, express_validator_1.validationResult)(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, errors: errors.array() });
                }
                const { token, password } = req.body;
                // Hash the provided token to compare with stored hash
                const resetTokenHash = crypto_1.default.createHash('sha256').update(token).digest('hex');
                // Find user with valid token
                const result = await connection_1.db.query(`SELECT id, email FROM users
         WHERE reset_token = $1
         AND reset_token_expires > CURRENT_TIMESTAMP
         AND is_active = true`, [resetTokenHash]);
                if (result.rows.length === 0) {
                    throw new errorHandler_1.AppError('Invalid or expired reset token', 400);
                }
                const user = result.rows[0];
                // Hash new password
                const passwordHash = await bcryptjs_1.default.hash(password, 12);
                // Update password and clear reset token
                await connection_1.db.query(`UPDATE users
         SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`, [passwordHash, user.id]);
                logger_1.logger.info(`Password reset successful for user ${user.email}`);
                res.json({
                    success: true,
                    message: 'Password has been reset successfully. You can now login with your new password.',
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map