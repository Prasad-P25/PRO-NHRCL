import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import projectRoutes from './routes/project.routes';
import packageRoutes from './routes/package.routes';
import categoryRoutes from './routes/category.routes';
import auditRoutes from './routes/audit.routes';
import capaRoutes from './routes/capa.routes';
import kpiRoutes from './routes/kpi.routes';
import dashboardRoutes from './routes/dashboard.routes';
import reportRoutes from './routes/report.routes';
import maturityRoutes from './routes/maturity.routes';
import roleRoutes from './routes/role.routes';
import notificationRoutes from './routes/notification.routes';
import scheduledReportRoutes from './routes/scheduled-report.routes';
import { db } from './database/connection';
import { logger } from './utils/logger';
import { startCapaReminderJob } from './jobs/capaReminder';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
const isDev = process.env.NODE_ENV !== 'production';
app.use(cors({
  origin: isDev ? true : (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Rate limiting - apply to all API routes
app.use('/api/', apiLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/packages', packageRoutes);
app.use('/api/v1/audit-categories', categoryRoutes);
app.use('/api/v1/audits', auditRoutes);
app.use('/api/v1/capa', capaRoutes);
app.use('/api/v1/kpi', kpiRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/maturity', maturityRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/scheduled-reports', scheduledReportRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await db.query('SELECT NOW()');
    logger.info('Database connected successfully');

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);

      // Start background jobs
      startCapaReminderJob();
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
