"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const audit_controller_1 = require("../controllers/audit.controller");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
const auditController = new audit_controller_1.AuditController();
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, process.env.UPLOAD_DIR || './uploads');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
        const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Invalid file type'));
    },
});
router.use(auth_1.authenticate);
// Audit CRUD
router.get('/', auditController.getAllAudits);
router.post('/', [
    (0, express_validator_1.body)('packageId').isInt().withMessage('Package ID is required'),
    (0, express_validator_1.body)('auditType').isIn(['Full', 'Partial', 'Focused']).withMessage('Invalid audit type'),
    (0, express_validator_1.body)('categoryIds').isArray().withMessage('Category IDs must be an array'),
], auditController.createAudit);
router.get('/:id', auditController.getAuditById);
router.get('/:id/export-word', auditController.exportToWord);
router.get('/:id/export-nc-report', auditController.exportNCReport);
router.put('/:id', auditController.updateAudit);
router.delete('/:id', auditController.deleteAudit);
// Audit workflow
router.post('/:id/submit', auditController.submitAudit);
router.post('/:id/approve', (0, auth_1.authorize)('Super Admin', 'PMC Head', 'Package Manager'), auditController.approveAudit);
router.post('/:id/reject', (0, auth_1.authorize)('Super Admin', 'PMC Head', 'Package Manager'), auditController.rejectAudit);
// Audit responses
router.get('/:id/responses', auditController.getAuditResponses);
router.post('/:id/responses', auditController.saveAuditResponses);
// Audit history (change log)
router.get('/:id/history', auditController.getAuditHistory);
// Audit comments
router.get('/:id/comments', auditController.getAuditComments);
router.post('/:id/comments', auditController.addAuditComment);
router.delete('/:id/comments/:commentId', auditController.deleteAuditComment);
// Audit attachments
router.get('/:id/attachments', auditController.getAuditAttachments);
router.post('/:id/attachments', upload.single('file'), auditController.uploadAuditAttachment);
router.delete('/:id/attachments/:attachmentId', auditController.deleteAuditAttachment);
// Evidence upload - rate limited (10 uploads per minute)
router.post('/responses/:responseId/evidence', rateLimiter_1.uploadLimiter, upload.single('file'), auditController.uploadEvidence);
router.delete('/responses/:responseId/evidence/:evidenceId', auditController.deleteEvidence);
exports.default = router;
//# sourceMappingURL=audit.routes.js.map