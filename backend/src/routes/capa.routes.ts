import { Router } from 'express';
import { body } from 'express-validator';
import { CAPAController } from '../controllers/capa.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const capaController = new CAPAController();

router.use(authenticate);

router.get('/', capaController.getAllCAPA);

router.get('/analytics', capaController.getAnalytics);

router.post(
  '/',
  [
    body('responseId').isInt().withMessage('Response ID is required'),
    body('findingDescription').notEmpty().withMessage('Finding description is required'),
  ],
  capaController.createCAPA
);

router.get('/:id', capaController.getCAPAById);

router.put('/:id', capaController.updateCAPA);

router.post('/:id/close', capaController.closeCAPA);

export default router;
