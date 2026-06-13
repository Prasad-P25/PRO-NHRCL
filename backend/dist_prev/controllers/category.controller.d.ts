import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class CategoryController {
    getAllCategories: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    getCategoryById: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getCategoryItems: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    createCategory: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    updateCategory: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    createSection: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    updateSection: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    deleteSection: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    createItem: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    updateItem: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    deleteItem: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=category.controller.d.ts.map