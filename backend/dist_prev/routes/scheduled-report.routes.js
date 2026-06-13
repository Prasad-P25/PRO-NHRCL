"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const scheduled_report_controller_1 = require("../controllers/scheduled-report.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const controller = new scheduled_report_controller_1.ScheduledReportController();
// All routes require authentication
router.use(auth_1.authenticate);
// Scheduled reports CRUD
router.get('/', controller.getAll);
router.get('/history', controller.getHistory);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);
// Actions
router.post('/:id/toggle', controller.toggleActive);
router.post('/:id/run', controller.runNow);
// On-demand generation
router.post('/generate', controller.generateReport);
router.delete('/generated/:id', controller.deleteGenerated);
exports.default = router;
//# sourceMappingURL=scheduled-report.routes.js.map