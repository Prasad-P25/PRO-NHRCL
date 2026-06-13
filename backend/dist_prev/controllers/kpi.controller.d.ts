import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class KPIController {
    getIndicators: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getEntries: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    createEntry: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    updateEntry: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getTrends: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getSummary: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=kpi.controller.d.ts.map