import { Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export class RoleController {
  // Get all roles
  getAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT r.*,
                (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) as user_count
         FROM roles r
         ORDER BY r.id`
      );

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
    } catch (error) {
      next(error);
    }
  };

  // Get role by ID
  getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await db.query('SELECT * FROM roles WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        throw new AppError('Role not found', 404);
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
    } catch (error) {
      next(error);
    }
  };

  // Create role
  create = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, permissions } = req.body;

      // Check if name exists
      const existing = await db.query('SELECT id FROM roles WHERE name = $1', [name]);
      if (existing.rows.length > 0) {
        throw new AppError('Role name already exists', 400);
      }

      const result = await db.query(
        `INSERT INTO roles (name, permissions)
         VALUES ($1, $2)
         RETURNING *`,
        [name, JSON.stringify(permissions || {})]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Role created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Update role
  update = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, permissions } = req.body;

      // Check if role exists
      const existing = await db.query('SELECT id FROM roles WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        throw new AppError('Role not found', 404);
      }

      // Check for duplicate name
      if (name) {
        const nameCheck = await db.query('SELECT id FROM roles WHERE name = $1 AND id != $2', [name, id]);
        if (nameCheck.rows.length > 0) {
          throw new AppError('Role name already exists', 400);
        }
      }

      await db.query(
        `UPDATE roles SET
         name = COALESCE($1, name),
         permissions = COALESCE($2, permissions)
         WHERE id = $3`,
        [name, permissions ? JSON.stringify(permissions) : null, id]
      );

      res.json({
        success: true,
        message: 'Role updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete role
  delete = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Check if role has users
      const userCheck = await db.query('SELECT COUNT(*) FROM users WHERE role_id = $1', [id]);
      if (parseInt(userCheck.rows[0].count) > 0) {
        throw new AppError('Cannot delete role with assigned users', 400);
      }

      await db.query('DELETE FROM roles WHERE id = $1', [id]);

      res.json({
        success: true,
        message: 'Role deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
