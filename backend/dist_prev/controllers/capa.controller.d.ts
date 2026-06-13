import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class CAPAController {
    getAllCAPA: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    createCAPA: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    getCAPAById: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    updateCAPA: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getAnalytics: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    closeCAPA: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=capa.controller.d.ts.map