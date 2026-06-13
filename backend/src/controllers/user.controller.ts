import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { db } from '../database/connection';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export class UserController {
  getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT u.*, r.name as role_name, r.permissions, p.code as package_code, p.name as package_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN packages p ON u.package_id = p.id
         WHERE u.id = $1`,
        [req.user!.id]
      );

      if (result.rows.length === 0) {
        throw new AppError('User not found', 404);
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
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, phone } = req.body;

      await db.query(
        'UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone), updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [name, phone, req.user!.id]
      );

      res.json({
        success: true,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getAllUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { page = 1, pageSize = 20, roleId, packageId, search } = req.query;
      const offset = (Number(page) - 1) * Number(pageSize);

      const baseFrom = `
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN packages p ON u.package_id = p.id
        WHERE 1=1
      `;
      let whereClause = '';
      const params: any[] = [];
      let paramIndex = 1;

      if (roleId) {
        whereClause += ` AND u.role_id = $${paramIndex++}`;
        params.push(roleId);
      }

      if (packageId) {
        whereClause += ` AND u.package_id = $${paramIndex++}`;
        params.push(packageId);
      }

      if (search) {
        whereClause += ` AND (u.name ILIKE $${paramIndex++} OR u.email ILIKE $${paramIndex++})`;
        params.push(`%${search}%`, `%${search}%`);
      }

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) ${baseFrom} ${whereClause}`,
        params
      );

      let query = `
        SELECT u.*, r.name as role_name, p.code as package_code, p.name as package_name
        ${baseFrom} ${whereClause}
      `;

      // Add pagination
      query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(Number(pageSize), offset);

      const result = await db.query(query, params);

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
    } catch (error) {
      next(error);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { email, password, name, roleId, packageId, phone } = req.body;

      // Check if email exists
      const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        throw new AppError('Email already exists', 400);
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const result = await db.query(
        `INSERT INTO users (email, password_hash, name, role_id, package_id, phone)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, name, role_id, package_id, is_active, created_at`,
        [email, passwordHash, name, roleId, packageId || null, phone || null]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  };

  getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT u.*, r.name as role_name, p.code as package_code, p.name as package_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN packages p ON u.package_id = p.id
         WHERE u.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError('User not found', 404);
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
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, roleId, packageId, phone, isActive } = req.body;

      await db.query(
        `UPDATE users SET
         name = COALESCE($1, name),
         role_id = COALESCE($2, role_id),
         package_id = $3,
         phone = COALESCE($4, phone),
         is_active = COALESCE($5, is_active),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [name, roleId, packageId || null, phone, isActive, id]
      );

      res.json({
        success: true,
        message: 'User updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Soft delete - just deactivate
      await db.query(
        'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );

      res.json({
        success: true,
        message: 'User deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Permanently delete a user — but ONLY if they have no audit-trail footprint.
   * A user who has conducted/approved audits, saved responses, verified CAPAs,
   * entered KPIs, etc. can never be erased (legal audit trail + FK integrity);
   * the caller is told to deactivate instead. Safe for unused/test accounts.
   */
  deleteUserPermanent = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = parseInt(id, 10);

      if (Number.isNaN(userId)) {
        throw new AppError('Invalid user id', 400);
      }
      if (req.user && req.user.id === userId) {
        throw new AppError('You cannot delete your own account', 400);
      }

      // Make sure the user exists
      const exists = await db.query('SELECT id, name FROM users WHERE id = $1', [userId]);
      if (exists.rows.length === 0) {
        throw new AppError('User not found', 404);
      }

      // Count every reference that represents real activity/history
      const refs = await db.query(
        `SELECT
           (SELECT count(*) FROM audits WHERE auditor_id=$1 OR reviewer_id=$1 OR approved_by=$1)
         + (SELECT count(*) FROM audit_responses WHERE updated_by=$1)
         + (SELECT count(*) FROM capa WHERE verified_by=$1)
         + (SELECT count(*) FROM audit_comments WHERE user_id=$1)
         + (SELECT count(*) FROM audit_attachments WHERE uploaded_by=$1)
         + (SELECT count(*) FROM audit_evidences WHERE uploaded_by=$1)
         + (SELECT count(*) FROM kpi_entries WHERE entered_by=$1)
         + (SELECT count(*) FROM maturity_assessments WHERE assessor_id=$1)
         + (SELECT count(*) FROM audit_response_history WHERE changed_by=$1)
         + (SELECT count(*) FROM audit_logs WHERE user_id=$1)
         + (SELECT count(*) FROM scheduled_reports WHERE created_by=$1)
         + (SELECT count(*) FROM generated_reports WHERE generated_by=$1)
         + (SELECT count(*) FROM projects WHERE created_by=$1) AS total`,
        [userId]
      );

      if (parseInt(refs.rows[0].total, 10) > 0) {
        throw new AppError(
          'This user has audit/activity history and cannot be permanently deleted. Deactivate them instead.',
          409
        );
      }

      // Clean delete: null out notifications this user SENT to others, then
      // delete the user (their own notifications + project assignments cascade).
      await db.transaction(async (client) => {
        await client.query('UPDATE notifications SET from_user_id = NULL WHERE from_user_id = $1', [userId]);
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
      });

      res.json({
        success: true,
        message: 'User permanently deleted',
      });
    } catch (error) {
      next(error);
    }
  };
}
