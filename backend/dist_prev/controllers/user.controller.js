"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const express_validator_1 = require("express-validator");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const connection_1 = require("../database/connection");
const errorHandler_1 = require("../middleware/errorHandler");
class UserController {
    constructor() {
        this.getProfile = async (req, res, next) => {
            try {
                const result = await connection_1.db.query(`SELECT u.*, r.name as role_name, r.permissions, p.code as package_code, p.name as package_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN packages p ON u.package_id = p.id
         WHERE u.id = $1`, [req.user.id]);
                if (result.rows.length === 0) {
                    throw new errorHandler_1.AppError('User not found', 404);
                }
                const user = result.rows[0];
                res.json({
                    success: true,
                    data: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        phone: user.phone,
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
                        lastLogin: user.last_login,
                        createdAt: user.created_at,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.updateProfile = async (req, res, next) => {
            try {
                const { name, phone } = req.body;
                await connection_1.db.query('UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone), updated_at = CURRENT_TIMESTAMP WHERE id = $3', [name, phone, req.user.id]);
                res.json({
                    success: true,
                    message: 'Profile updated successfully',
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.getAllUsers = async (req, res, next) => {
            try {
                const { page = 1, pageSize = 20, roleId, packageId, search } = req.query;
                const offset = (Number(page) - 1) * Number(pageSize);
                let query = `
        SELECT u.*, r.name as role_name, p.code as package_code, p.name as package_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN packages p ON u.package_id = p.id
        WHERE 1=1
      `;
                const params = [];
                let paramIndex = 1;
                if (roleId) {
                    query += ` AND u.role_id = $${paramIndex++}`;
                    params.push(roleId);
                }
                if (packageId) {
                    query += ` AND u.package_id = $${paramIndex++}`;
                    params.push(packageId);
                }
                if (search) {
                    query += ` AND (u.name ILIKE $${paramIndex++} OR u.email ILIKE $${paramIndex++})`;
                    params.push(`%${search}%`, `%${search}%`);
                }
                // Get total count
                const countResult = await connection_1.db.query(query.replace('SELECT u.*, r.name as role_name, p.code as package_code, p.name as package_name', 'SELECT COUNT(*)'), params);
                // Add pagination
                query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
                params.push(Number(pageSize), offset);
                const result = await connection_1.db.query(query, params);
                res.json({
                    success: true,
                    data: result.rows.map((user) => ({
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        phone: user.phone,
                        role: {
                            id: user.role_id,
                            name: user.role_name,
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
                        lastLogin: user.last_login,
                        createdAt: user.created_at,
                    })),
                    total: parseInt(countResult.rows[0].count),
                    page: Number(page),
                    pageSize: Number(pageSize),
                    totalPages: Math.ceil(parseInt(countResult.rows[0].count) / Number(pageSize)),
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.createUser = async (req, res, next) => {
            try {
                const errors = (0, express_validator_1.validationResult)(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, errors: errors.array() });
                }
                const { email, password, name, roleId, packageId, phone } = req.body;
                // Check if email exists
                const existingUser = await connection_1.db.query('SELECT id FROM users WHERE email = $1', [email]);
                if (existingUser.rows.length > 0) {
                    throw new errorHandler_1.AppError('Email already exists', 400);
                }
                const passwordHash = await bcryptjs_1.default.hash(password, 12);
                const result = await connection_1.db.query(`INSERT INTO users (email, password_hash, name, role_id, package_id, phone)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, name, role_id, package_id, is_active, created_at`, [email, passwordHash, name, roleId, packageId || null, phone || null]);
                res.status(201).json({
                    success: true,
                    data: result.rows[0],
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.getUserById = async (req, res, next) => {
            try {
                const { id } = req.params;
                const result = await connection_1.db.query(`SELECT u.*, r.name as role_name, p.code as package_code, p.name as package_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN packages p ON u.package_id = p.id
         WHERE u.id = $1`, [id]);
                if (result.rows.length === 0) {
                    throw new errorHandler_1.AppError('User not found', 404);
                }
                const user = result.rows[0];
                res.json({
                    success: true,
                    data: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        phone: user.phone,
                        role: {
                            id: user.role_id,
                            name: user.role_name,
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
                        lastLogin: user.last_login,
                        createdAt: user.created_at,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.updateUser = async (req, res, next) => {
            try {
                const { id } = req.params;
                const { name, roleId, packageId, phone, isActive } = req.body;
                await connection_1.db.query(`UPDATE users SET
         name = COALESCE($1, name),
         role_id = COALESCE($2, role_id),
         package_id = $3,
         phone = COALESCE($4, phone),
         is_active = COALESCE($5, is_active),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`, [name, roleId, packageId || null, phone, isActive, id]);
                res.json({
                    success: true,
                    message: 'User updated successfully',
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.deleteUser = async (req, res, next) => {
            try {
                const { id } = req.params;
                // Soft delete - just deactivate
                await connection_1.db.query('UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
                res.json({
                    success: true,
                    message: 'User deactivated successfully',
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.UserController = UserController;
//# sourceMappingURL=user.controller.js.map