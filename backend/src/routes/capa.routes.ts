import { Router } from 'express';
import { body } from 'express-validator';
import { CAPAController } from '../controllers/capa.controller';
import { authenticate, authorize } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimiter';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const router = Router();
const capaController = new CAPAController();

// Roles allowed to review client rectifications (approve/reject).
const reviewRoles = ['Super Admin', 'PMC Head', 'Package Manager', 'Auditor'] as const;

// File uploads for client "fixed" photos (same scheme as audit evidence).
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Invalid file type'));
  },
});

router.use(authenticate);

// --- Client rectification portal (Client role, scoped to their package) ---
router.get('/my-corrections', authorize('Client'), capaController.getMyCorrections);
router.post(
  '/:id/rectification-evidence',
  authorize('Client'),
  uploadLimiter,
  upload.single('file'),
  capaController.uploadRectificationEvidence
);
router.delete(
  '/:id/rectification-evidence/:evidenceId',
  authorize('Client'),
  capaController.deleteRectificationEvidence
);
router.post('/:id/submit-rectification', authorize('Client'), capaController.submitRectification);

// --- Auditor-side review of client submissions ---
router.get('/review-queue', authorize(...reviewRoles), capaController.getReviewQueue);
router.post('/:id/review', authorize(...reviewRoles), capaController.reviewRectification);

// --- Existing CAPA management ---
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
