import { Router } from 'express';
import { ScheduledReportController } from '../controllers/scheduled-report.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const controller = new ScheduledReportController();

// All routes require authentication
router.use(authenticate);

// Scheduled reports CRUD
router.get('/', controller.getAll);
router.get('/history', controller.getHistory);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

// Actions
router.post('/:id/toggle', controller.toggleActive);
router.post('/:id/run', controller.runNow);

// On-demand generation
router.post('/generate', controller.generateReport);
router.delete('/generated/:id', controller.deleteGenerated);

export default router;
