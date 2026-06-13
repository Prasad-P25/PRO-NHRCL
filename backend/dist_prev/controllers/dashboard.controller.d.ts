import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class DashboardController {
    getOverview: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getPackageDashboard: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getProjectComparison: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getKPISummary: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=dashboard.controller.d.ts.map