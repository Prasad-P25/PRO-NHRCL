import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../database/connection';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { tokenBlacklist } from '../utils/tokenBlacklist';
import { logger } from '../utils/logger';
import { emailService } from '../services/email.service';

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
      // Extract token and add to blacklist
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        // Blacklist token for 24 hours (same as JWT expiry)
        tokenBlacklist.add(token, 24 * 60 * 60 * 1000);
        logger.info(`Token blacklisted for user ${req.user?.id}`);
      }

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

      // Check if old token is blacklisted
      if (tokenBlacklist.isBlacklisted(token)) {
        throw new AppError('Token has been revoked', 401);
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'default-secret',
        { ignoreExpiration: true }
      ) as { userId: number };

      // Blacklist the old token
      tokenBlacklist.add(token, 24 * 60 * 60 * 1000);

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

      const result = await db.query('SELECT id, name FROM users WHERE email = $1 AND is_active = true', [email]);

      if (result.rows.length > 0) {
        const user = result.rows[0];

        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Token expires in 1 hour
        const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

        // Save hashed token to database
        await db.query(
          'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
          [resetTokenHash, resetTokenExpires, user.id]
        );

        // Generate reset URL
        const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
        logger.info(`Password reset requested for ${email}`);

        // Send password reset email (non-blocking to prevent timeout)
        emailService.sendPasswordReset(email, {
          name: user.name,
          resetUrl,
        }).catch(err => logger.error('Failed to send password reset email:', err));
      }

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

      // Hash the provided token to compare with stored hash
      const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Find user with valid token
      const result = await db.query(
        `SELECT id, email FROM users
         WHERE reset_token = $1
         AND reset_token_expires > CURRENT_TIMESTAMP
         AND is_active = true`,
        [resetTokenHash]
      );

      if (result.rows.length === 0) {
        throw new AppError('Invalid or expired reset token', 400);
      }

      const user = result.rows[0];

      // Hash new password
      const passwordHash = await bcrypt.hash(password, 12);

      // Update password and clear reset token
      await db.query(
        `UPDATE users
         SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [passwordHash, user.id]
      );

      logger.info(`Password reset successful for user ${user.email}`);

      res.json({
        success: true,
        message: 'Password has been reset successfully. You can now login with your new password.',
      });
    } catch (error) {
      next(error);
    }
  };
}
