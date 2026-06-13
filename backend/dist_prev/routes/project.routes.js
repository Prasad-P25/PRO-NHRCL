"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const project_controller_1 = require("../controllers/project.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const projectController = new project_controller_1.ProjectController();
// All routes require authentication
router.use(auth_1.authenticate);
// Get user's accessible projects
router.get('/', projectController.getUserProjects);
// Get single project
router.get('/:id', projectController.getProjectById);
// Create project (Super Admin only)
router.post('/', (0, auth_1.authorize)('Super Admin'), [
    (0, express_validator_1.body)('code').trim().notEmpty().withMessage('Project code is required')
        .isLength({ max: 20 }).withMessage('Code must be 20 characters or less'),
    (0, express_validator_1.body)('name').trim().notEmpty().withMessage('Project name is required')
        .isLength({ max: 255 }).withMessage('Name must be 255 characters or less'),
    (0, express_validator_1.body)('description').optional().trim(),
    (0, express_validator_1.body)('clientName').optional().trim(),
    (0, express_validator_1.body)('location').optional().trim(),
    (0, express_validator_1.body)('startDate').optional().isISO8601().withMessage('Invalid start date'),
    (0, express_validator_1.body)('endDate').optional().isISO8601().withMessage('Invalid end date'),
], projectController.createProject);
// Update project (Super Admin only)
router.put('/:id', (0, auth_1.authorize)('Super Admin'), projectController.updateProject);
// Delete project (Super Admin only)
router.delete('/:id', (0, auth_1.authorize)('Super Admin'), projectController.deleteProject);
// Get project users
router.get('/:id/users', projectController.getProjectUsers);
// Assign user to project (Super Admin only)
router.post('/:id/users', (0, auth_1.authorize)('Super Admin'), [
    (0, express_validator_1.body)('userId').isInt().withMessage('Valid user ID is required'),
    (0, express_validator_1.body)('isDefault').optional().isBoolean(),
], projectController.assignUser);
// Remove user from project (Super Admin only)
router.delete('/:id/users/:userId', (0, auth_1.authorize)('Super Admin'), projectController.removeUser);
// Set project as default for current user
router.post('/:id/set-default', projectController.setDefaultProject);
exports.default = router;
//# sourceMappingURL=project.routes.js.map