"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageController = void 0;
const express_validator_1 = require("express-validator");
const connection_1 = require("../database/connection");
const errorHandler_1 = require("../middleware/errorHandler");
class PackageController {
    constructor() {
        this.getAllPackages = async (req, res, next) => {
            try {
                const projectId = req.projectId;
                let query;
                let params;
                if (projectId) {
                    // Filter by current project
                    query = `SELECT * FROM packages WHERE status = $1 AND project_id = $2 ORDER BY code`;
                    params = ['Active', projectId];
                }
                else {
                    // No project context - return empty or all based on role
                    if (req.user?.roleName === 'Super Admin') {
                        query = `SELECT * FROM packages WHERE status = $1 ORDER BY code`;
                        params = ['Active'];
                    }
                    else {
                        // Return only packages from user's assigned projects
                        query = `
            SELECT p.* FROM packages p
            JOIN user_project_assignments upa ON p.project_id = upa.project_id
            WHERE p.status = $1 AND upa.user_id = $2
            ORDER BY p.code
          `;
                        params = ['Active', req.user.id];
                    }
                }
                const result = await connection_1.db.query(query, params);
                res.json({
                    success: true,
                    data: result.rows.map((pkg) => ({
                        id: pkg.id,
                        projectId: pkg.project_id,
                        code: pkg.code,
                        name: pkg.name,
                        location: pkg.location,
                        description: pkg.description,
                        contractorName: pkg.contractor_name,
                        status: pkg.status,
                        createdAt: pkg.created_at,
                    })),
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.getPackageById = async (req, res, next) => {
            try {
                const { id } = req.params;
                const result = await connection_1.db.query('SELECT * FROM packages WHERE id = $1', [id]);
                if (result.rows.length === 0) {
                    throw new errorHandler_1.AppError('Package not found', 404);
                }
                const pkg = result.rows[0];
                res.json({
                    success: true,
                    data: {
                        id: pkg.id,
                        projectId: pkg.project_id,
                        code: pkg.code,
                        name: pkg.name,
                        location: pkg.location,
                        description: pkg.description,
                        contractorName: pkg.contractor_name,
                        status: pkg.status,
                        createdAt: pkg.created_at,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.getPackageAudits = async (req, res, next) => {
            try {
                const { id } = req.params;
                const result = await connection_1.db.query(`SELECT a.*, u.name as auditor_name
         FROM audits a
         LEFT JOIN users u ON a.auditor_id = u.id
         WHERE a.package_id = $1
         ORDER BY a.created_at DESC`, [id]);
                res.json({
                    success: true,
                    data: result.rows.map((audit) => ({
                        id: audit.id,
                        auditNumber: audit.audit_number,
                        auditType: audit.audit_type,
                        auditorName: audit.auditor_name,
                        status: audit.status,
                        compliancePercentage: audit.compliance_percentage,
                        createdAt: audit.created_at,
                    })),
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.getPackageKPIs = async (req, res, next) => {
            try {
                const { id } = req.params;
                const { periodMonth, periodYear } = req.query;
                let query = `
        SELECT ke.*, ki.name as indicator_name, ki.type, ki.unit, ki.benchmark_value
        FROM kpi_entries ke
        JOIN kpi_indicators ki ON ke.indicator_id = ki.id
        WHERE ke.package_id = $1
      `;
                const params = [id];
                let paramIndex = 2;
                if (periodMonth) {
                    query += ` AND ke.period_month = $${paramIndex++}`;
                    params.push(periodMonth);
                }
                if (periodYear) {
                    query += ` AND ke.period_year = $${paramIndex++}`;
                    params.push(periodYear);
                }
                query += ' ORDER BY ke.period_year DESC, ke.period_month DESC, ki.display_order';
                const result = await connection_1.db.query(query, params);
                res.json({
                    success: true,
                    data: result.rows.map((entry) => ({
                        id: entry.id,
                        indicatorId: entry.indicator_id,
                        indicatorName: entry.indicator_name,
                        type: entry.type,
                        unit: entry.unit,
                        benchmarkValue: entry.benchmark_value,
                        periodMonth: entry.period_month,
                        periodYear: entry.period_year,
                        targetValue: entry.target_value,
                        actualValue: entry.actual_value,
                        manHoursWorked: entry.man_hours_worked,
                    })),
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.createPackage = async (req, res, next) => {
            try {
                const errors = (0, express_validator_1.validationResult)(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, errors: errors.array() });
                }
                const { code, name, location, description, contractorName, projectId } = req.body;
                // Use projectId from body or from request context
                const targetProjectId = projectId || req.projectId;
                if (!targetProjectId) {
                    return res.status(400).json({
                        success: false,
                        message: 'Project ID is required. Please select a project.',
                    });
                }
                const result = await connection_1.db.query(`INSERT INTO packages (project_id, code, name, location, description, contractor_name)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`, [targetProjectId, code, name, location || null, description || null, contractorName || null]);
                const pkg = result.rows[0];
                res.status(201).json({
                    success: true,
                    data: {
                        id: pkg.id,
                        projectId: pkg.project_id,
                        code: pkg.code,
                        name: pkg.name,
                        location: pkg.location,
                        description: pkg.description,
                        contractorName: pkg.contractor_name,
                        status: pkg.status,
                        createdAt: pkg.created_at,
                    },
                });
            }
            catch (error) {
                if (error.code === '23505') {
                    next(new errorHandler_1.AppError('Package code already exists in this project', 400));
                }
                else {
                    next(error);
                }
            }
        };
        this.updatePackage = async (req, res, next) => {
            try {
                const { id } = req.params;
                const { name, location, description, contractorName, status } = req.body;
                await connection_1.db.query(`UPDATE packages SET
         name = COALESCE($1, name),
         location = COALESCE($2, location),
         description = COALESCE($3, description),
         contractor_name = COALESCE($4, contractor_name),
         status = COALESCE($5, status)
         WHERE id = $6`, [name, location, description, contractorName, status, id]);
                res.json({
                    success: true,
                    message: 'Package updated successfully',
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.PackageController = PackageController;
//# sourceMappingURL=package.controller.js.map