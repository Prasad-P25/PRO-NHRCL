"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectController = void 0;
const express_validator_1 = require("express-validator");
const connection_1 = require("../database/connection");
const errorHandler_1 = require("../middleware/errorHandler");
class ProjectController {
    constructor() {
        /**
         * Get all projects accessible to the current user
         */
        this.getUserProjects = async (req, res, next) => {
            try {
                const userId = req.user.id;
                const isSuperAdmin = req.user.roleName === 'Super Admin';
                let query;
                let params;
                if (isSuperAdmin) {
                    // Super Admin can see all projects
                    query = `
          SELECT p.*,
                 (SELECT COUNT(*) FROM packages WHERE project_id = p.id) as package_count,
                 (SELECT COUNT(*) FROM user_project_assignments WHERE project_id = p.id) as user_count
          FROM projects p
          WHERE p.status != 'Deleted'
          ORDER BY p.name
        `;
                    params = [];
                }
                else {
                    // Regular users see only assigned projects
                    query = `
          SELECT p.*,
                 upa.is_default,
                 (SELECT COUNT(*) FROM packages WHERE project_id = p.id) as package_count,
                 (SELECT COUNT(*) FROM user_project_assignments WHERE project_id = p.id) as user_count
          FROM projects p
          JOIN user_project_assignments upa ON p.id = upa.project_id
          WHERE upa.user_id = $1 AND p.status != 'Deleted'
          ORDER BY upa.is_default DESC, p.name
        `;
                    params = [userId];
                }
                const result = await connection_1.db.query(query, params);
                res.json({
                    success: true,
                    data: result.rows.map((p) => ({
                        id: p.id,
                        code: p.code,
                        name: p.name,
                        description: p.description,
                        clientName: p.client_name,
                        location: p.location,
                        startDate: p.start_date,
                        endDate: p.end_date,
                        status: p.status,
                        settings: p.settings,
                        isDefault: p.is_default || false,
                        packageCount: parseInt(p.package_count) || 0,
                        userCount: parseInt(p.user_count) || 0,
                        createdAt: p.created_at,
                        updatedAt: p.updated_at,
                    })),
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Get a single project by ID
         */
        this.getProjectById = async (req, res, next) => {
            try {
                const { id } = req.params;
                const userId = req.user.id;
                const isSuperAdmin = req.user.roleName === 'Super Admin';
                // Check access
                if (!isSuperAdmin) {
                    const accessCheck = await connection_1.db.query(`SELECT 1 FROM user_project_assignments WHERE user_id = $1 AND project_id = $2`, [userId, id]);
                    if (accessCheck.rows.length === 0) {
                        throw new errorHandler_1.AppError('Access denied to this project', 403);
                    }
                }
                const result = await connection_1.db.query(`SELECT p.*,
                (SELECT COUNT(*) FROM packages WHERE project_id = p.id) as package_count,
                (SELECT COUNT(*) FROM user_project_assignments WHERE project_id = p.id) as user_count
         FROM projects p
         WHERE p.id = $1`, [id]);
                if (result.rows.length === 0) {
                    throw new errorHandler_1.AppError('Project not found', 404);
                }
                const p = result.rows[0];
                res.json({
                    success: true,
                    data: {
                        id: p.id,
                        code: p.code,
                        name: p.name,
                        description: p.description,
                        clientName: p.client_name,
                        location: p.location,
                        startDate: p.start_date,
                        endDate: p.end_date,
                        status: p.status,
                        settings: p.settings,
                        packageCount: parseInt(p.package_count) || 0,
                        userCount: parseInt(p.user_count) || 0,
                        createdAt: p.created_at,
                        updatedAt: p.updated_at,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Create a new project (Super Admin only)
         */
        this.createProject = async (req, res, next) => {
            try {
                const errors = (0, express_validator_1.validationResult)(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, errors: errors.array() });
                }
                const { code, name, description, clientName, location, startDate, endDate, settings } = req.body;
                const createdBy = req.user.id;
                const result = await connection_1.db.query(`INSERT INTO projects (code, name, description, client_name, location, start_date, end_date, settings, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`, [code, name, description || null, clientName || null, location || null,
                    startDate || null, endDate || null, settings || {}, createdBy]);
                const p = result.rows[0];
                // Assign the creator to the project
                await connection_1.db.query(`INSERT INTO user_project_assignments (user_id, project_id, is_default)
         VALUES ($1, $2, false)`, [createdBy, p.id]);
                res.status(201).json({
                    success: true,
                    data: {
                        id: p.id,
                        code: p.code,
                        name: p.name,
                        description: p.description,
                        clientName: p.client_name,
                        location: p.location,
                        startDate: p.start_date,
                        endDate: p.end_date,
                        status: p.status,
                        settings: p.settings,
                        createdAt: p.created_at,
                    },
                    message: 'Project created successfully',
                });
            }
            catch (error) {
                if (error.code === '23505') {
                    next(new errorHandler_1.AppError('Project code already exists', 400));
                }
                else {
                    next(error);
                }
            }
        };
        /**
         * Update a project
         */
        this.updateProject = async (req, res, next) => {
            try {
                const { id } = req.params;
                const { name, description, clientName, location, startDate, endDate, status, settings } = req.body;
                const result = await connection_1.db.query(`UPDATE projects SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         client_name = COALESCE($3, client_name),
         location = COALESCE($4, location),
         start_date = COALESCE($5, start_date),
         end_date = COALESCE($6, end_date),
         status = COALESCE($7, status),
         settings = COALESCE($8, settings),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING *`, [name, description, clientName, location, startDate, endDate, status, settings, id]);
                if (result.rows.length === 0) {
                    throw new errorHandler_1.AppError('Project not found', 404);
                }
                res.json({
                    success: true,
                    message: 'Project updated successfully',
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Delete a project (soft delete)
         */
        this.deleteProject = async (req, res, next) => {
            try {
                const { id } = req.params;
                // Check if project has packages
                const packageCheck = await connection_1.db.query(`SELECT COUNT(*) FROM packages WHERE project_id = $1`, [id]);
                if (parseInt(packageCheck.rows[0].count) > 0) {
                    throw new errorHandler_1.AppError('Cannot delete project with existing packages. Remove packages first.', 400);
                }
                await connection_1.db.query(`UPDATE projects SET status = 'Deleted', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
                res.json({
                    success: true,
                    message: 'Project deleted successfully',
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Get users assigned to a project
         */
        this.getProjectUsers = async (req, res, next) => {
            try {
                const { id } = req.params;
                const result = await connection_1.db.query(`SELECT upa.id as assignment_id, u.id as user_id, u.email, u.name, u.phone, u.is_active,
                r.name as role_name,
                upa.is_default, upa.assigned_at
         FROM users u
         JOIN user_project_assignments upa ON u.id = upa.user_id
         JOIN roles r ON u.role_id = r.id
         WHERE upa.project_id = $1
         ORDER BY u.name`, [id]);
                res.json({
                    success: true,
                    data: result.rows.map((u) => ({
                        id: u.assignment_id,
                        userId: u.user_id,
                        email: u.email,
                        name: u.name,
                        phone: u.phone,
                        isActive: u.is_active,
                        roleName: u.role_name,
                        isDefault: u.is_default,
                        assignedAt: u.assigned_at,
                    })),
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Assign a user to a project
         */
        this.assignUser = async (req, res, next) => {
            try {
                const { id } = req.params;
                const { userId, isDefault } = req.body;
                if (!userId) {
                    throw new errorHandler_1.AppError('User ID is required', 400);
                }
                // Check if user exists
                const userCheck = await connection_1.db.query(`SELECT id FROM users WHERE id = $1`, [userId]);
                if (userCheck.rows.length === 0) {
                    throw new errorHandler_1.AppError('User not found', 404);
                }
                // If setting as default, unset other defaults for this user
                if (isDefault) {
                    await connection_1.db.query(`UPDATE user_project_assignments SET is_default = false WHERE user_id = $1`, [userId]);
                }
                await connection_1.db.query(`INSERT INTO user_project_assignments (user_id, project_id, is_default)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, project_id) DO UPDATE SET is_default = $3`, [userId, id, isDefault || false]);
                res.json({
                    success: true,
                    message: 'User assigned to project successfully',
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Remove a user from a project
         */
        this.removeUser = async (req, res, next) => {
            try {
                const { id, userId } = req.params;
                // Check if this is the user's only project
                const projectCount = await connection_1.db.query(`SELECT COUNT(*) FROM user_project_assignments WHERE user_id = $1`, [userId]);
                if (parseInt(projectCount.rows[0].count) <= 1) {
                    throw new errorHandler_1.AppError('Cannot remove user from their only project', 400);
                }
                await connection_1.db.query(`DELETE FROM user_project_assignments WHERE user_id = $1 AND project_id = $2`, [userId, id]);
                res.json({
                    success: true,
                    message: 'User removed from project successfully',
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Set a project as default for a user (current user or specified user for admins)
         */
        this.setDefaultProject = async (req, res, next) => {
            try {
                const { id } = req.params;
                const isSuperAdmin = req.user.roleName === 'Super Admin';
                // Admins can set default for other users
                const targetUserId = (isSuperAdmin && req.body.userId) ? req.body.userId : req.user.id;
                // Check if target user has access to this project
                const accessCheck = await connection_1.db.query(`SELECT 1 FROM user_project_assignments WHERE user_id = $1 AND project_id = $2`, [targetUserId, id]);
                if (accessCheck.rows.length === 0) {
                    throw new errorHandler_1.AppError('User does not have access to this project', 403);
                }
                // Unset all defaults for this user
                await connection_1.db.query(`UPDATE user_project_assignments SET is_default = false WHERE user_id = $1`, [targetUserId]);
                // Set the new default
                await connection_1.db.query(`UPDATE user_project_assignments SET is_default = true WHERE user_id = $1 AND project_id = $2`, [targetUserId, id]);
                res.json({
                    success: true,
                    message: 'Default project updated',
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.ProjectController = ProjectController;
//# sourceMappingURL=project.controller.js.map