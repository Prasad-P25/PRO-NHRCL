import { Router } from 'express';
import { body } from 'express-validator';
import { PackageController } from '../controllers/package.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const packageController = new PackageController();

router.use(authenticate);

router.get('/', packageController.getAllPackages);

router.get('/:id', packageController.getPackageById);

router.get('/:id/audits', packageController.getPackageAudits);

router.get('/:id/kpis', packageController.getPackageKPIs);

// Admin routes
router.post(
  '/',
  authorize('Super Admin'),
  [
    body('code').notEmpty().withMessage('Package code is required'),
    body('name').notEmpty().withMessage('Package name is required'),
  ],
  packageController.createPackage
);

router.put('/:id', authorize('Super Admin'), packageController.updatePackage);

export default router;
