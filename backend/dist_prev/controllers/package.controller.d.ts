import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class PackageController {
    getAllPackages: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getPackageById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getPackageAudits: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getPackageKPIs: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    createPackage: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    updatePackage: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=package.controller.d.ts.map