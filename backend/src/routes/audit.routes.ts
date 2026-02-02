import { Router } from 'express';
import { body } from 'express-validator';
import { AuditController } from '../controllers/audit.controller';
import { authenticate, authorize } from '../middleware/auth';
import multer from 'multer';
import path from 'path';

const router = Router();
const auditController = new AuditController();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  },
});

router.use(authenticate);

// Audit CRUD
router.get('/', auditController.getAllAudits);

router.post(
  '/',
  [
    body('packageId').isInt().withMessage('Package ID is required'),
    body('auditType').isIn(['Full', 'Partial', 'Focused']).withMessage('Invalid audit type'),
    body('categoryIds').isArray().withMessage('Category IDs must be an array'),
  ],
  auditController.createAudit
);

router.get('/:id', auditController.getAuditById);

router.get('/:id/export-word', auditController.exportToWord);

router.put('/:id', auditController.updateAudit);

router.delete('/:id', auditController.deleteAudit);

// Audit workflow
router.post('/:id/submit', auditController.submitAudit);

router.post(
  '/:id/approve',
  authorize('Super Admin', 'PMC Head', 'Package Manager'),
  auditController.approveAudit
);

router.post(
  '/:id/reject',
  authorize('Super Admin', 'PMC Head', 'Package Manager'),
  auditController.rejectAudit
);

// Audit responses
router.get('/:id/responses', auditController.getAuditResponses);

router.post('/:id/responses', auditController.saveAuditResponses);

// Evidence upload
router.post(
  '/responses/:responseId/evidence',
  upload.single('file'),
  auditController.uploadEvidence
);

router.delete(
  '/responses/:responseId/evidence/:evidenceId',
  auditController.deleteEvidence
);

export default router;
