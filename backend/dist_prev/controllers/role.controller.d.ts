import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class RoleController {
    getAll: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    create: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    update: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    delete: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=role.controller.d.ts.map