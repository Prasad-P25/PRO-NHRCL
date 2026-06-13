import { Router } from 'express';
import { body } from 'express-validator';
import { AuditController } from '../controllers/audit.controller';
import { authenticate, authorize } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimiter';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const router = Router();
const auditController = new AuditController();

// Roles allowed to create/modify audits and responses
const auditWriteRoles = ['Super Admin', 'PMC Head', 'Package Manager', 'Auditor'] as const;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    // Unguessable filename: uploads are served statically without auth
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
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
  authorize(...auditWriteRoles),
  [
    body('packageId').isInt().withMessage('Package ID is required'),
    body('auditType').isIn(['Full', 'Partial', 'Focused']).withMessage('Invalid audit type'),
    body('categoryIds').isArray().withMessage('Category IDs must be an array'),
  ],
  auditController.createAudit
);

router.get('/:id', auditController.getAuditById);

router.get('/:id/export-word', auditController.exportToWord);

router.get('/:id/export-nc-report', auditController.exportNCReport);

router.put('/:id', authorize(...auditWriteRoles), auditController.updateAudit);

router.delete('/:id', authorize(...auditWriteRoles), auditController.deleteAudit);

// Audit workflow
router.post('/:id/submit', authorize(...auditWriteRoles), auditController.submitAudit);

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

router.post('/:id/responses', authorize(...auditWriteRoles), auditController.saveAuditResponses);

// Audit history (change log)
router.get('/:id/history', auditController.getAuditHistory);

// Audit comments
router.get('/:id/comments', auditController.getAuditComments);
router.post('/:id/comments', auditController.addAuditComment);
router.delete('/:id/comments/:commentId', auditController.deleteAuditComment);

// Audit attachments
router.get('/:id/attachments', auditController.getAuditAttachments);
router.post(
  '/:id/attachments',
  authorize(...auditWriteRoles),
  upload.single('file'),
  auditController.uploadAuditAttachment
);
router.delete(
  '/:id/attachments/:attachmentId',
  authorize(...auditWriteRoles),
  auditController.deleteAuditAttachment
);

// Evidence upload - rate limited (10 uploads per minute)
router.post(
  '/responses/:responseId/evidence',
  authorize(...auditWriteRoles),
  uploadLimiter,
  upload.single('file'),
  auditController.uploadEvidence
);

router.delete(
  '/responses/:responseId/evidence/:evidenceId',
  authorize(...auditWriteRoles),
  auditController.deleteEvidence
);

export default router;
