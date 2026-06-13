import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class ReportController {
    getComplianceSummary: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getNCsSummary: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getCAPAStatus: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getTrendAnalysis: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getPackageComparison: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    exportReport: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=report.controller.d.ts.map