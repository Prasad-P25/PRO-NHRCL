import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database/connection';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export class AuthController {
  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { email, password } = req.body;

      const result = await db.query(
        `SELECT u.*, r.name as role_name, r.permissions, p.code as package_code, p.name as package_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN packages p ON u.package_id = p.id
         WHERE u.email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        throw new AppError('Invalid email or password', 401);
      }

      const user = result.rows[0];

      if (!user.is_active) {
        throw new AppError('Account is inactive', 401);
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw new AppError('Invalid email or password', 401);
      }

      // Update last login
      await db.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as jwt.SignOptions['expiresIn'] }
      );

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
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // In a production app, you might want to blacklist the token
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('No token provided', 401);
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'default-secret',
        { ignoreExpiration: true }
      ) as { userId: number };

      const newToken = jwt.sign(
        { userId: decoded.userId },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as jwt.SignOptions['expiresIn'] }
      );

      res.json({
        success: true,
        data: { token: newToken },
      });
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { email } = req.body;

      const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);

      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { token, password } = req.body;

      // In a production app, validate the reset token
      // For now, just return an error
      throw new AppError('Invalid or expired reset token', 400);
    } catch (error) {
      next(error);
    }
  };
}
