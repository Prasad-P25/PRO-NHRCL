"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const package_controller_1 = require("../controllers/package.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const packageController = new package_controller_1.PackageController();
router.use(auth_1.authenticate);
router.get('/', packageController.getAllPackages);
router.get('/:id', packageController.getPackageById);
router.get('/:id/audits', packageController.getPackageAudits);
router.get('/:id/kpis', packageController.getPackageKPIs);
// Admin routes
router.post('/', (0, auth_1.authorize)('Super Admin'), [
    (0, express_validator_1.body)('code').notEmpty().withMessage('Package code is required'),
    (0, express_validator_1.body)('name').notEmpty().withMessage('Package name is required'),
], packageController.createPackage);
router.put('/:id', (0, auth_1.authorize)('Super Admin'), packageController.updatePackage);
exports.default = router;
//# sourceMappingURL=package.routes.js.map