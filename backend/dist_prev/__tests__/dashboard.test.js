"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Mock database
jest.mock('../database/connection', () => ({
    db: { query: jest.fn() },
}));
// Mock logger
jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
// Mock rate limiter
jest.mock('../middleware/rateLimiter', () => ({
    authLimiter: (req, res, next) => next(),
    apiLimiter: (req, res, next) => next(),
    uploadLimiter: (req, res, next) => next(),
}));
const connection_1 = require("../database/connection");
const errorHandler_1 = require("../middleware/errorHandler");
const tokenBlacklist_1 = require("../utils/tokenBlacklist");
const mockDb = connection_1.db;
const createTestApp = () => {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    const dashboardRoutes = require('../routes/dashboard.routes').default;
    app.use('/api/v1/dashboard', dashboardRoutes);
    app.use(errorHandler_1.errorHandler);
    return app;
};
const createToken = (userId) => jsonwebtoken_1.default.sign({ userId }, process.env.JWT_SECRET);
const mockSuperAdmin = {
    id: 1, email: 'admin@protecther.in', name: 'Super Admin',
    role_id: 1, role_name: 'Super Admin', package_id: null,
};
const mockAuditor = {
    id: 2, email: 'auditor@protecther.in', name: 'Auditor',
    role_id: 4, role_name: 'Auditor', package_id: 1,
};
describe('Dashboard API', () => {
    let app;
    beforeAll(() => {
        process.env.JWT_SECRET = 'test-secret-key';
        app = createTestApp();
    });
    afterAll(() => jest.clearAllTimers());
    beforeEach(() => {
        jest.clearAllMocks();
        tokenBlacklist_1.tokenBlacklist.clear();
    });
    describe('GET /api/v1/dashboard/overview', () => {
        it('should require authentication', async () => {
            const res = await (0, supertest_1.default)(app).get('/api/v1/dashboard/overview');
            expect(res.status).toBe(401);
        });
    });
    describe('GET /api/v1/dashboard/project-comparison', () => {
        it('should require authentication', async () => {
            const res = await (0, supertest_1.default)(app).get('/api/v1/dashboard/project-comparison');
            expect(res.status).toBe(401);
        });
    });
    describe('GET /api/v1/dashboard/package/:id', () => {
        it('should return package dashboard', async () => {
            const token = createToken(2);
            mockDb.query.mockResolvedValueOnce({ rows: [mockAuditor] });
            mockDb.query.mockResolvedValueOnce({ rows: [] });
            // Package info
            mockDb.query.mockResolvedValueOnce({
                rows: [{ id: 1, name: 'Package C1', code: 'C1' }],
            });
            // Audit stats
            mockDb.query.mockResolvedValueOnce({
                rows: [{ total: '15', approved: '12', avg_compliance: '87.5' }],
            });
            // CAPA stats
            mockDb.query.mockResolvedValueOnce({
                rows: [{ open: '3', overdue: '1' }],
            });
            const res = await (0, supertest_1.default)(app)
                .get('/api/v1/dashboard/package/1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should require authentication for package dashboard', async () => {
            const res = await (0, supertest_1.default)(app).get('/api/v1/dashboard/package/999');
            expect(res.status).toBe(401);
        });
    });
    describe('GET /api/v1/dashboard/kpi-summary', () => {
        it('should require authentication', async () => {
            const res = await (0, supertest_1.default)(app).get('/api/v1/dashboard/kpi-summary');
            expect(res.status).toBe(401);
        });
    });
});
describe('Dashboard Metrics Calculation', () => {
    describe('Compliance Trend', () => {
        const calculateTrend = (current, previous) => {
            if (previous === 0)
                return null;
            return Math.round(((current - previous) / previous) * 100 * 10) / 10;
        };
        it('should calculate positive trend', () => {
            expect(calculateTrend(90, 80)).toBe(12.5);
        });
        it('should calculate negative trend', () => {
            expect(calculateTrend(75, 85)).toBeCloseTo(-11.8, 1);
        });
        it('should handle zero previous value', () => {
            expect(calculateTrend(90, 0)).toBeNull();
        });
    });
    describe('KPI Status Classification', () => {
        const getKPIStatus = (actual, benchmark, type) => {
            if (type === 'Lagging') {
                // For lagging (like LTIFR), lower is better
                if (actual <= benchmark * 0.8)
                    return 'Good';
                if (actual <= benchmark)
                    return 'Warning';
                return 'Critical';
            }
            else {
                // For leading (like inspections), higher is better
                if (actual >= benchmark * 1.2)
                    return 'Good';
                if (actual >= benchmark)
                    return 'Warning';
                return 'Critical';
            }
        };
        it('should classify lagging KPIs correctly', () => {
            expect(getKPIStatus(1.5, 2.0, 'Lagging')).toBe('Good'); // Below benchmark
            expect(getKPIStatus(1.9, 2.0, 'Lagging')).toBe('Warning'); // At benchmark
            expect(getKPIStatus(2.5, 2.0, 'Lagging')).toBe('Critical'); // Above benchmark
        });
        it('should classify leading KPIs correctly', () => {
            expect(getKPIStatus(120, 100, 'Leading')).toBe('Good'); // Above benchmark
            expect(getKPIStatus(100, 100, 'Leading')).toBe('Warning'); // At benchmark
            expect(getKPIStatus(80, 100, 'Leading')).toBe('Critical'); // Below benchmark
        });
    });
    describe('CAPA Closure Rate', () => {
        const calculateClosureRate = (closed, total) => {
            if (total === 0)
                return 0;
            return Math.round((closed / total) * 100);
        };
        it('should calculate closure rate correctly', () => {
            expect(calculateClosureRate(15, 20)).toBe(75);
            expect(calculateClosureRate(0, 10)).toBe(0);
            expect(calculateClosureRate(10, 10)).toBe(100);
        });
        it('should handle zero total', () => {
            expect(calculateClosureRate(0, 0)).toBe(0);
        });
    });
});
describe('Dashboard Data Aggregation', () => {
    describe('Monthly Aggregation', () => {
        const aggregateByMonth = (data) => {
            const grouped = new Map();
            data.forEach(({ date, value }) => {
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (!grouped.has(key))
                    grouped.set(key, []);
                grouped.get(key).push(value);
            });
            return Array.from(grouped.entries()).map(([month, values]) => ({
                month,
                average: values.reduce((a, b) => a + b, 0) / values.length,
                count: values.length,
            }));
        };
        it('should aggregate data by month', () => {
            const data = [
                { date: new Date('2024-01-15'), value: 85 },
                { date: new Date('2024-01-20'), value: 90 },
                { date: new Date('2024-02-10'), value: 88 },
            ];
            const result = aggregateByMonth(data);
            expect(result).toHaveLength(2);
            expect(result[0].month).toBe('2024-01');
            expect(result[0].average).toBe(87.5);
            expect(result[0].count).toBe(2);
        });
    });
});
//# sourceMappingURL=dashboard.test.js.map