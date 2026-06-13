"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const kpi_controller_1 = require("../controllers/kpi.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const kpiController = new kpi_controller_1.KPIController();
router.use(auth_1.authenticate);
router.get('/indicators', kpiController.getIndicators);
router.get('/summary', kpiController.getSummary);
router.get('/trends', kpiController.getTrends);
router.get('/entries', kpiController.getEntries);
router.post('/entries', (0, auth_1.authorize)('Super Admin', 'PMC Head', 'Package Manager'), [
    (0, express_validator_1.body)('packageId').isInt().withMessage('Package ID is required'),
    (0, express_validator_1.body)('indicatorId').isInt().withMessage('Indicator ID is required'),
    (0, express_validator_1.body)('periodMonth').isInt({ min: 1, max: 12 }).withMessage('Valid month is required'),
    (0, express_validator_1.body)('periodYear').isInt({ min: 2020, max: 2100 }).withMessage('Valid year is required'),
], kpiController.createEntry);
router.put('/entries/:id', (0, auth_1.authorize)('Super Admin', 'PMC Head', 'Package Manager'), kpiController.updateEntry);
exports.default = router;
//# sourceMappingURL=kpi.routes.js.map