"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const maturity_controller_1 = require("../controllers/maturity.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const maturityController = new maturity_controller_1.MaturityController();
router.use(auth_1.authenticate);
// Get maturity model structure
router.get('/model', maturityController.getMaturityModel);
// Get all assessments
router.get('/', maturityController.getAll);
// Get single assessment
router.get('/:id', maturityController.getById);
// Get dimension summary for an assessment
router.get('/:id/summary', maturityController.getDimensionSummary);
// Create new assessment
router.post('/', maturityController.create);
// Update responses
router.put('/:id/responses', maturityController.updateResponses);
// Submit assessment
router.post('/:id/submit', maturityController.submit);
// Delete assessment
router.delete('/:id', maturityController.delete);
exports.default = router;
//# sourceMappingURL=maturity.routes.js.map