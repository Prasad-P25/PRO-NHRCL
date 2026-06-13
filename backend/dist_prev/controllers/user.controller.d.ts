import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class UserController {
    getProfile: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    updateProfile: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getAllUsers: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    createUser: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    getUserById: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    updateUser: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    deleteUser: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=user.controller.d.ts.map