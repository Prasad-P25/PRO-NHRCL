"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const role_controller_1 = require("../controllers/role.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const roleController = new role_controller_1.RoleController();
router.use(auth_1.authenticate);
// Get all roles
router.get('/', roleController.getAll);
// Get role by ID
router.get('/:id', roleController.getById);
// Admin only routes
router.post('/', (0, auth_1.authorize)('Super Admin'), roleController.create);
router.put('/:id', (0, auth_1.authorize)('Super Admin'), roleController.update);
router.delete('/:id', (0, auth_1.authorize)('Super Admin'), roleController.delete);
exports.default = router;
//# sourceMappingURL=role.routes.js.map