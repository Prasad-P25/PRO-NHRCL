import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const reportController = new ReportController();

router.use(authenticate);

router.get('/compliance-summary', reportController.getComplianceSummary);

router.get('/nc-summary', reportController.getNCsSummary);

router.get('/capa-status', reportController.getCAPAStatus);

router.get('/trend-analysis', reportController.getTrendAnalysis);

router.get('/package-comparison', reportController.getPackageComparison);

router.post('/export', reportController.exportReport);

export default router;
