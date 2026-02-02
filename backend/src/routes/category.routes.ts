import { Router } from 'express';
import { body } from 'express-validator';
import { CategoryController } from '../controllers/category.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const categoryController = new CategoryController();

router.use(authenticate);

// Read routes
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
router.get('/:id/items', categoryController.getCategoryItems);

// Category CRUD (admin only)
router.post(
  '/',
  authorize('Super Admin'),
  [
    body('code').notEmpty().withMessage('Code is required'),
    body('name').notEmpty().withMessage('Name is required'),
  ],
  categoryController.createCategory
);
router.put('/:id', authorize('Super Admin'), categoryController.updateCategory);

// Section CRUD
router.post('/sections', authorize('Super Admin'), categoryController.createSection);
router.put('/sections/:id', authorize('Super Admin'), categoryController.updateSection);
router.delete('/sections/:id', authorize('Super Admin'), categoryController.deleteSection);

// Item CRUD
router.post('/items', authorize('Super Admin'), categoryController.createItem);
router.put('/items/:id', authorize('Super Admin'), categoryController.updateItem);
router.delete('/items/:id', authorize('Super Admin'), categoryController.deleteItem);

export default router;
