import { Router } from 'express';
import { MaturityController } from '../controllers/maturity.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const maturityController = new MaturityController();

router.use(authenticate);

// Get maturity model structure
router.get('/model', maturityController.getMaturityModel);

// Get all assessments
router.get('/', maturityController.getAll);

// Get single assessment
router.get('/:id', maturityController.getById);

// Get dimension summary for an assessment
router.get('/:id/summary', maturityController.getDimensionSummary);

// Create new assessment
router.post('/', maturityController.create);

// Update responses
router.put('/:id/responses', maturityController.updateResponses);

// Submit assessment
router.post('/:id/submit', maturityController.submit);

// Delete assessment
router.delete('/:id', maturityController.delete);

export default router;
