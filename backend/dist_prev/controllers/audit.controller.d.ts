import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class AuditController {
    getAllAudits: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    createAudit: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    getAuditById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    updateAudit: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    deleteAudit: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    submitAudit: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    approveAudit: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    rejectAudit: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getAuditResponses: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    saveAuditResponses: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    uploadEvidence: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    deleteEvidence: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    exportToWord: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    exportNCReport: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getAuditComments: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    addAuditComment: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    deleteAuditComment: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getAuditAttachments: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    uploadAuditAttachment: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    deleteAuditAttachment: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getAuditHistory: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=audit.controller.d.ts.map