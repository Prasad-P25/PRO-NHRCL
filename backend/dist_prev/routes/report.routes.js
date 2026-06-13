"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const report_controller_1 = require("../controllers/report.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const reportController = new report_controller_1.ReportController();
router.use(auth_1.authenticate);
router.get('/compliance-summary', reportController.getComplianceSummary);
router.get('/nc-summary', reportController.getNCsSummary);
router.get('/capa-status', reportController.getCAPAStatus);
router.get('/trend-analysis', reportController.getTrendAnalysis);
router.get('/package-comparison', reportController.getPackageComparison);
router.post('/export', reportController.exportReport);
exports.default = router;
//# sourceMappingURL=report.routes.js.map