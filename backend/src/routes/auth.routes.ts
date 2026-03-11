import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();
const authController = new AuthController();

// Login - strict rate limit (5 attempts per minute)
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  authController.login
);

router.post('/logout', authenticate, authController.logout);

router.post('/refresh', authController.refreshToken);

// Forgot password - strict rate limit
router.post(
  '/forgot-password',
  authLimiter,
  [body('email').isEmail().withMessage('Please provide a valid email')],
  authController.forgotPassword
);

// Reset password - strict rate limit
router.post(
  '/reset-password',
  authLimiter,
  [
    body('token').notEmpty().withMessage('Token is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  authController.resetPassword
);

export default router;
