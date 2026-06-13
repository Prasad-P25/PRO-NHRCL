import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class MaturityController {
    getMaturityModel: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getAll: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    create: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    updateResponses: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    submit: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    getDimensionSummary: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    delete: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
}
//# sourceMappingURL=maturity.controller.d.ts.map