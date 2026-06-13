import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import { db } from '../database/connection';
import { tokenBlacklist } from '../utils/tokenBlacklist';
import { getJwtSecret } from '../config/jwt';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
    roleId: number;
    roleName: string;
    packageId?: number;
  };
  projectId?: number;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted (logged out)
    if (tokenBlacklist.isBlacklisted(token)) {
      throw new AppError('Token has been revoked', 401);
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      userId: number;
      iat?: number;
    };

    const result = await db.query(
      `SELECT u.id, u.email, u.name, u.role_id, u.package_id, u.password_changed_at, r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found or inactive', 401);
    }

    const user = result.rows[0];

    // Reject tokens issued before the user's last password change
    if (
      user.password_changed_at &&
      decoded.iat &&
      decoded.iat * 1000 < new Date(user.password_changed_at).getTime()
    ) {
      throw new AppError('Token invalidated by password change', 401);
    }
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
    const projectIdStr = (projectIdHeader as string) || (projectIdQuery as string);

    if (projectIdStr) {
      const projectId = parseInt(projectIdStr, 10);
      if (!isNaN(projectId)) {
        // Validate user has access to this project
        const accessCheck = await db.query(
          `SELECT 1 FROM user_project_assignments
           WHERE user_id = $1 AND project_id = $2`,
          [user.id, projectId]
        );

        if (accessCheck.rows.length > 0 || user.role_name === 'Super Admin') {
          req.projectId = projectId;
        } else {
          throw new AppError('Access denied to this project', 403);
        }
      }
    } else {
      // If no project specified, get user's default project
      const defaultProject = await db.query(
        `SELECT project_id FROM user_project_assignments
         WHERE user_id = $1 AND is_default = true
         LIMIT 1`,
        [user.id]
      );
      if (defaultProject.rows.length > 0) {
        req.projectId = defaultProject.rows[0].project_id;
      }
    }

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token', 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token expired', 401));
    } else {
      next(error);
    }
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    if (!roles.includes(req.user.roleName)) {
      return next(new AppError('Not authorized to access this resource', 403));
    }

    next();
  };
};
