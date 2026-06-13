"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const user_controller_1 = require("../controllers/user.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const userController = new user_controller_1.UserController();
// All routes require authentication
router.use(auth_1.authenticate);
// Get current user profile
router.get('/me', userController.getProfile);
// Update current user profile
router.put('/me', userController.updateProfile);
// Admin routes
router.get('/', (0, auth_1.authorize)('Super Admin', 'PMC Head'), userController.getAllUsers);
router.post('/', (0, auth_1.authorize)('Super Admin'), [
    (0, express_validator_1.body)('email').isEmail().withMessage('Please provide a valid email'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    (0, express_validator_1.body)('name').notEmpty().withMessage('Name is required'),
    (0, express_validator_1.body)('roleId').isInt().withMessage('Role ID is required'),
], userController.createUser);
router.get('/:id', (0, auth_1.authorize)('Super Admin', 'PMC Head'), userController.getUserById);
router.put('/:id', (0, auth_1.authorize)('Super Admin'), userController.updateUser);
router.delete('/:id', (0, auth_1.authorize)('Super Admin'), userController.deleteUser);
exports.default = router;
//# sourceMappingURL=user.routes.js.map