"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const category_controller_1 = require("../controllers/category.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const categoryController = new category_controller_1.CategoryController();
router.use(auth_1.authenticate);
// Read routes
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
router.get('/:id/items', categoryController.getCategoryItems);
// Category CRUD (admin only)
router.post('/', (0, auth_1.authorize)('Super Admin'), [
    (0, express_validator_1.body)('code').notEmpty().withMessage('Code is required'),
    (0, express_validator_1.body)('name').notEmpty().withMessage('Name is required'),
], categoryController.createCategory);
router.put('/:id', (0, auth_1.authorize)('Super Admin'), categoryController.updateCategory);
// Section CRUD
router.post('/sections', (0, auth_1.authorize)('Super Admin'), categoryController.createSection);
router.put('/sections/:id', (0, auth_1.authorize)('Super Admin'), categoryController.updateSection);
router.delete('/sections/:id', (0, auth_1.authorize)('Super Admin'), categoryController.deleteSection);
// Item CRUD
router.post('/items', (0, auth_1.authorize)('Super Admin'), categoryController.createItem);
router.put('/items/:id', (0, auth_1.authorize)('Super Admin'), categoryController.updateItem);
router.delete('/items/:id', (0, auth_1.authorize)('Super Admin'), categoryController.deleteItem);
exports.default = router;
//# sourceMappingURL=category.routes.js.map