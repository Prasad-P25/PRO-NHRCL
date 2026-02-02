import { Router } from 'express';
import { body } from 'express-validator';
import { UserController } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const userController = new UserController();

// All routes require authentication
router.use(authenticate);

// Get current user profile
router.get('/me', userController.getProfile);

// Update current user profile
router.put('/me', userController.updateProfile);

// Admin routes
router.get('/', authorize('Super Admin', 'PMC Head'), userController.getAllUsers);

router.post(
  '/',
  authorize('Super Admin'),
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('roleId').isInt().withMessage('Role ID is required'),
  ],
  userController.createUser
);

router.get('/:id', authorize('Super Admin', 'PMC Head'), userController.getUserById);

router.put('/:id', authorize('Super Admin'), userController.updateUser);

router.delete('/:id', authorize('Super Admin'), userController.deleteUser);

export default router;
