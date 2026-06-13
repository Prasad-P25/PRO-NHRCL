import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class ProjectController {
    /**
     * Get all projects accessible to the current user
     */
    getUserProjects: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Get a single project by ID
     */
    getProjectById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Create a new project (Super Admin only)
     */
    createProject: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Update a project
     */
    updateProject: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Delete a project (soft delete)
     */
    deleteProject: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Get users assigned to a project
     */
    getProjectUsers: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Assign a user to a project
     */
    assignUser: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Remove a user from a project
     */
    removeUser: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Set a project as default for a user (current user or specified user for admins)
     */
    setDefaultProject: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=project.controller.d.ts.map