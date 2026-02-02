import { Router } from 'express';
import { body } from 'express-validator';
import { KPIController } from '../controllers/kpi.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const kpiController = new KPIController();

router.use(authenticate);

router.get('/indicators', kpiController.getIndicators);

router.get('/summary', kpiController.getSummary);

router.get('/entries', kpiController.getEntries);

router.post(
  '/entries',
  authorize('Super Admin', 'PMC Head', 'Package Manager'),
  [
    body('packageId').isInt().withMessage('Package ID is required'),
    body('indicatorId').isInt().withMessage('Indicator ID is required'),
    body('periodMonth').isInt({ min: 1, max: 12 }).withMessage('Valid month is required'),
    body('periodYear').isInt({ min: 2020, max: 2100 }).withMessage('Valid year is required'),
  ],
  kpiController.createEntry
);

router.put(
  '/entries/:id',
  authorize('Super Admin', 'PMC Head', 'Package Manager'),
  kpiController.updateEntry
);

export default router;
