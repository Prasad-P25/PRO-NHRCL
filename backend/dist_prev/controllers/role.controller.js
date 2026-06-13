"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleController = void 0;
const connection_1 = require("../database/connection");
const errorHandler_1 = require("../middleware/errorHandler");
class RoleController {
    constructor() {
        // Get all roles
        this.getAll = async (req, res, next) => {
            try {
                const result = await connection_1.db.query(`SELECT r.*,
                (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) as user_count
         FROM roles r
         ORDER BY r.id`);
                res.json({
                    success: true,
                    data: result.rows.map((role) => ({
                        id: role.id,
                        name: role.name,
                        permissions: role.permissions,
                        userCount: parseInt(role.user_count),
                        createdAt: role.created_at,
                    })),
                });
            }
            catch (error) {
                next(error);
            }
        };
        // Get role by ID
        this.getById = async (req, res, next) => {
            try {
                const { id } = req.params;
                const result = await connection_1.db.query('SELECT * FROM roles WHERE id = $1', [id]);
                if (result.rows.length === 0) {
                    throw new errorHandler_1.AppError('Role not found', 404);
                }
                const role = result.rows[0];
                res.json({
                    success: true,
                    data: {
                        id: role.id,
                        name: role.name,
                        permissions: role.permissions,
                        createdAt: role.created_at,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        // Create role
        this.create = async (req, res, next) => {
            try {
                const { name, permissions } = req.body;
                // Check if name exists
                const existing = await connection_1.db.query('SELECT id FROM roles WHERE name = $1', [name]);
                if (existing.rows.length > 0) {
                    throw new errorHandler_1.AppError('Role name already exists', 400);
                }
                const result = await connection_1.db.query(`INSERT INTO roles (name, permissions)
         VALUES ($1, $2)
         RETURNING *`, [name, JSON.stringify(permissions || {})]);
                res.status(201).json({
                    success: true,
                    data: result.rows[0],
                    message: 'Role created successfully',
                });
            }
            catch (error) {
                next(error);
            }
        };
        // Update role
        this.update = async (req, res, next) => {
            try {
                const { id } = req.params;
                const { name, permissions } = req.body;
                // Check if role exists
                const existing = await connection_1.db.query('SELECT id FROM roles WHERE id = $1', [id]);
                if (existing.rows.length === 0) {
                    throw new errorHandler_1.AppError('Role not found', 404);
                }
                // Check for duplicate name
                if (name) {
                    const nameCheck = await connection_1.db.query('SELECT id FROM roles WHERE name = $1 AND id != $2', [name, id]);
                    if (nameCheck.rows.length > 0) {
                        throw new errorHandler_1.AppError('Role name already exists', 400);
                    }
                }
                await connection_1.db.query(`UPDATE roles SET
         name = COALESCE($1, name),
         permissions = COALESCE($2, permissions)
         WHERE id = $3`, [name, permissions ? JSON.stringify(permissions) : null, id]);
                res.json({
                    success: true,
                    message: 'Role updated successfully',
                });
            }
            catch (error) {
                next(error);
            }
        };
        // Delete role
        this.delete = async (req, res, next) => {
            try {
                const { id } = req.params;
                // Check if role has users
                const userCheck = await connection_1.db.query('SELECT COUNT(*) FROM users WHERE role_id = $1', [id]);
                if (parseInt(userCheck.rows[0].count) > 0) {
                    throw new errorHandler_1.AppError('Cannot delete role with assigned users', 400);
                }
                await connection_1.db.query('DELETE FROM roles WHERE id = $1', [id]);
                res.json({
                    success: true,
                    message: 'Role deleted successfully',
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.RoleController = RoleController;
//# sourceMappingURL=role.controller.js.map