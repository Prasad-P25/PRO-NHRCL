import { Router } from 'express';
import { RoleController } from '../controllers/role.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const roleController = new RoleController();

router.use(authenticate);

// Get all roles
router.get('/', roleController.getAll);

// Get role by ID
router.get('/:id', roleController.getById);

// Admin only routes
router.post('/', authorize('Super Admin'), roleController.create);
router.put('/:id', authorize('Super Admin'), roleController.update);
router.delete('/:id', authorize('Super Admin'), roleController.delete);

export default router;
