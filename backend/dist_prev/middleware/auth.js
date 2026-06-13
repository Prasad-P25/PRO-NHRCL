"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errorHandler_1 = require("./errorHandler");
const connection_1 = require("../database/connection");
const tokenBlacklist_1 = require("../utils/tokenBlacklist");
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errorHandler_1.AppError('No token provided', 401);
        }
        const token = authHeader.split(' ')[1];
        // Check if token is blacklisted (logged out)
        if (tokenBlacklist_1.tokenBlacklist.isBlacklisted(token)) {
            throw new errorHandler_1.AppError('Token has been revoked', 401);
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'default-secret');
        const result = await connection_1.db.query(`SELECT u.id, u.email, u.name, u.role_id, u.package_id, r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.is_active = true`, [decoded.userId]);
        if (result.rows.length === 0) {
            throw new errorHandler_1.AppError('User not found or inactive', 401);
        }
        const user = result.rows[0];
        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            roleId: user.role_id,
            roleName: user.role_name,
            packageId: user.package_id,
        };
        // Extract project ID from header or query param
        const projectIdHeader = req.headers['x-project-id'];
        const projectIdQuery = req.query.projectId;
        const projectIdStr = projectIdHeader || projectIdQuery;
        if (projectIdStr) {
            const projectId = parseInt(projectIdStr, 10);
            if (!isNaN(projectId)) {
                // Validate user has access to this project
                const accessCheck = await connection_1.db.query(`SELECT 1 FROM user_project_assignments
           WHERE user_id = $1 AND project_id = $2`, [user.id, projectId]);
                if (accessCheck.rows.length > 0 || user.role_name === 'Super Admin') {
                    req.projectId = projectId;
                }
                else {
                    throw new errorHandler_1.AppError('Access denied to this project', 403);
                }
            }
        }
        else {
            // If no project specified, get user's default project
            const defaultProject = await connection_1.db.query(`SELECT project_id FROM user_project_assignments
         WHERE user_id = $1 AND is_default = true
         LIMIT 1`, [user.id]);
            if (defaultProject.rows.length > 0) {
                req.projectId = defaultProject.rows[0].project_id;
            }
        }
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            next(new errorHandler_1.AppError('Invalid token', 401));
        }
        else if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            next(new errorHandler_1.AppError('Token expired', 401));
        }
        else {
            next(error);
        }
    }
};
exports.authenticate = authenticate;
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new errorHandler_1.AppError('Not authenticated', 401));
        }
        if (!roles.includes(req.user.roleName)) {
            return next(new errorHandler_1.AppError('Not authorized to access this resource', 403));
        }
        next();
    };
};
exports.authorize = authorize;
//# sourceMappingURL=auth.js.map