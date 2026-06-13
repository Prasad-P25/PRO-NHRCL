"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const errorHandler_1 = require("./middleware/errorHandler");
const requestLogger_1 = require("./middleware/requestLogger");
const rateLimiter_1 = require("./middleware/rateLimiter");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const project_routes_1 = __importDefault(require("./routes/project.routes"));
const package_routes_1 = __importDefault(require("./routes/package.routes"));
const category_routes_1 = __importDefault(require("./routes/category.routes"));
const audit_routes_1 = __importDefault(require("./routes/audit.routes"));
const capa_routes_1 = __importDefault(require("./routes/capa.routes"));
const kpi_routes_1 = __importDefault(require("./routes/kpi.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const report_routes_1 = __importDefault(require("./routes/report.routes"));
const maturity_routes_1 = __importDefault(require("./routes/maturity.routes"));
const role_routes_1 = __importDefault(require("./routes/role.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const scheduled_report_routes_1 = __importDefault(require("./routes/scheduled-report.routes"));
const connection_1 = require("./database/connection");
const logger_1 = require("./utils/logger");
const capaReminder_1 = require("./jobs/capaReminder");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Trust proxy for Cloudflare/reverse proxy (fixes rate limiter warnings)
app.set('trust proxy', 1);
// Middleware
app.use((0, helmet_1.default)());
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
const isDev = process.env.NODE_ENV !== 'production';
app.use((0, cors_1.default)({
    origin: isDev ? true : (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(requestLogger_1.requestLogger);
// Serve uploaded files statically
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Rate limiting - apply to all API routes
app.use('/api/', rateLimiter_1.apiLimiter);
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// API Routes
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/users', user_routes_1.default);
app.use('/api/v1/projects', project_routes_1.default);
app.use('/api/v1/packages', package_routes_1.default);
app.use('/api/v1/audit-categories', category_routes_1.default);
app.use('/api/v1/audits', audit_routes_1.default);
app.use('/api/v1/capa', capa_routes_1.default);
app.use('/api/v1/kpi', kpi_routes_1.default);
app.use('/api/v1/dashboard', dashboard_routes_1.default);
app.use('/api/v1/reports', report_routes_1.default);
app.use('/api/v1/maturity', maturity_routes_1.default);
app.use('/api/v1/roles', role_routes_1.default);
app.use('/api/v1/notifications', notification_routes_1.default);
app.use('/api/v1/scheduled-reports', scheduled_report_routes_1.default);
// Error handling
app.use(errorHandler_1.errorHandler);
// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});
// Start server
const startServer = async () => {
    try {
        // Test database connection
        await connection_1.db.query('SELECT NOW()');
        logger_1.logger.info('Database connected successfully');
        app.listen(PORT, () => {
            logger_1.logger.info(`Server running on port ${PORT}`);
            logger_1.logger.info(`Environment: ${process.env.NODE_ENV}`);
            // Start background jobs
            (0, capaReminder_1.startCapaReminderJob)();
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map