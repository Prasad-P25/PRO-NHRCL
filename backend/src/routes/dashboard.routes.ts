import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const dashboardController = new DashboardController();

router.use(authenticate);

router.get('/overview', dashboardController.getOverview);

router.get('/project-comparison', dashboardController.getProjectComparison);

router.get('/package/:id', dashboardController.getPackageDashboard);

router.get('/kpi-summary', dashboardController.getKPISummary);

export default router;
