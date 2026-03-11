import { Router } from 'express';
import { body } from 'express-validator';
import { ProjectController } from '../controllers/project.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const projectController = new ProjectController();

// All routes require authentication
router.use(authenticate);

// Get user's accessible projects
router.get('/', projectController.getUserProjects);

// Get single project
router.get('/:id', projectController.getProjectById);

// Create project (Super Admin only)
router.post(
  '/',
  authorize('Super Admin'),
  [
    body('code').trim().notEmpty().withMessage('Project code is required')
      .isLength({ max: 20 }).withMessage('Code must be 20 characters or less'),
    body('name').trim().notEmpty().withMessage('Project name is required')
      .isLength({ max: 255 }).withMessage('Name must be 255 characters or less'),
    body('description').optional().trim(),
    body('clientName').optional().trim(),
    body('location').optional().trim(),
    body('startDate').optional().isISO8601().withMessage('Invalid start date'),
    body('endDate').optional().isISO8601().withMessage('Invalid end date'),
  ],
  projectController.createProject
);

// Update project (Super Admin only)
router.put(
  '/:id',
  authorize('Super Admin'),
  projectController.updateProject
);

// Delete project (Super Admin only)
router.delete(
  '/:id',
  authorize('Super Admin'),
  projectController.deleteProject
);

// Get project users
router.get('/:id/users', projectController.getProjectUsers);

// Assign user to project (Super Admin only)
router.post(
  '/:id/users',
  authorize('Super Admin'),
  [
    body('userId').isInt().withMessage('Valid user ID is required'),
    body('isDefault').optional().isBoolean(),
  ],
  projectController.assignUser
);

// Remove user from project (Super Admin only)
router.delete(
  '/:id/users/:userId',
  authorize('Super Admin'),
  projectController.removeUser
);

// Set project as default for current user
router.post('/:id/set-default', projectController.setDefaultProject);

export default router;
