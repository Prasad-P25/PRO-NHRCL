"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const capa_controller_1 = require("../controllers/capa.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const capaController = new capa_controller_1.CAPAController();
router.use(auth_1.authenticate);
router.get('/', capaController.getAllCAPA);
router.get('/analytics', capaController.getAnalytics);
router.post('/', [
    (0, express_validator_1.body)('responseId').isInt().withMessage('Response ID is required'),
    (0, express_validator_1.body)('findingDescription').notEmpty().withMessage('Finding description is required'),
], capaController.createCAPA);
router.get('/:id', capaController.getCAPAById);
router.put('/:id', capaController.updateCAPA);
router.post('/:id/close', capaController.closeCAPA);
exports.default = router;
//# sourceMappingURL=capa.routes.js.map