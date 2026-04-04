import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

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
  authLimiter: (req: any, res: any, next: any) => next(),
  apiLimiter: (req: any, res: any, next: any) => next(),
  uploadLimiter: (req: any, res: any, next: any) => next(),
}));

// Mock email service
jest.mock('../services/email.service', () => ({
  emailService: {
    sendCapaCreated: jest.fn().mockResolvedValue(true),
    sendCapaCompleted: jest.fn().mockResolvedValue(true),
  },
}));

import { db } from '../database/connection';
import { errorHandler } from '../middleware/errorHandler';
import { tokenBlacklist } from '../utils/tokenBlacklist';

const mockDb = db as jest.Mocked<typeof db>;

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  const capaRoutes = require('../routes/capa.routes').default;
  app.use('/api/v1/capa', capaRoutes);
  app.use(errorHandler);
  return app;
};

const createToken = (userId: number) => jwt.sign({ userId }, process.env.JWT_SECRET!);

const mockSuperAdmin = {
  id: 1, email: 'admin@protecther.in', name: 'Super Admin',
  role_id: 1, role_name: 'Super Admin', package_id: null,
};

const mockPackageManager = {
  id: 2, email: 'manager@protecther.in', name: 'Package Manager',
  role_id: 3, role_name: 'Package Manager', package_id: 1,
};

const sampleCAPA = {
  id: 1,
  capa_number: 'CAPA-2024-0001',
  response_id: 10,
  finding_description: 'Missing safety signage',
  root_cause: 'Signage damaged by weather',
  corrective_action: 'Replace signage',
  preventive_action: 'Use weather-resistant materials',
  responsible_person: 'John Doe',
  target_date: new Date('2024-04-15'),
  status: 'Open',
  created_at: new Date(),
};

describe('CAPA API', () => {
  let app: express.Application;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key';
    app = createTestApp();
  });

  afterAll(() => jest.clearAllTimers());
  beforeEach(() => {
    jest.clearAllMocks();
    tokenBlacklist.clear();
  });

  describe('GET /api/v1/capa', () => {
    it('should return paginated CAPAs', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '15' }] } as any);
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { ...sampleCAPA, audit_number: 'AUD-C1-2024-001' },
          { ...sampleCAPA, id: 2, capa_number: 'CAPA-2024-0002' },
        ],
      } as any);

      const res = await request(app)
        .get('/api/v1/capa')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter CAPAs by status', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '5' }] } as any);
      mockDb.query.mockResolvedValueOnce({
        rows: [{ ...sampleCAPA, status: 'Closed' }],
      } as any);

      const res = await request(app)
        .get('/api/v1/capa?status=Closed')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/v1/capa');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/capa/analytics', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/v1/capa/analytics');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/capa', () => {
    it('should reject missing finding description', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .post('/api/v1/capa')
        .set('Authorization', `Bearer ${token}`)
        .send({ responseId: 10 });

      expect(res.status).toBe(400);
    });

    it('should reject missing response ID', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .post('/api/v1/capa')
        .set('Authorization', `Bearer ${token}`)
        .send({ findingDescription: 'Test finding' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/capa/:id', () => {
    it('should return CAPA details', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({
        rows: [{ ...sampleCAPA, audit_number: 'AUD-C1-2024-001', item_name: 'Safety signage check' }],
      } as any);

      const res = await request(app)
        .get('/api/v1/capa/1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.capaNumber).toBe('CAPA-2024-0001');
    });

    it('should return 404 for non-existent CAPA', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .get('/api/v1/capa/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/capa/:id', () => {
    it('should update CAPA', async () => {
      const token = createToken(2);

      mockDb.query.mockResolvedValueOnce({ rows: [mockPackageManager] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [sampleCAPA] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .put('/api/v1/capa/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          rootCause: 'Updated root cause',
          correctiveAction: 'Updated corrective action',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('updated');
    });
  });

  describe('POST /api/v1/capa/:id/close', () => {
    it('should require authentication to close CAPA', async () => {
      const res = await request(app)
        .post('/api/v1/capa/1/close')
        .send({ verificationNotes: 'Test' });

      expect(res.status).toBe(401);
    });
  });
});

describe('CAPA Business Logic', () => {
  describe('CAPA Number Format', () => {
    const generateCAPANumber = (year: number, count: number) =>
      `CAPA-${year}-${String(count).padStart(4, '0')}`;

    it('should generate correct format', () => {
      expect(generateCAPANumber(2024, 1)).toBe('CAPA-2024-0001');
      expect(generateCAPANumber(2024, 999)).toBe('CAPA-2024-0999');
      expect(generateCAPANumber(2025, 1234)).toBe('CAPA-2025-1234');
    });
  });

  describe('CAPA Status Workflow', () => {
    const validStatuses = ['Open', 'In Progress', 'Closed'];

    it('should have valid status values', () => {
      expect(validStatuses).toContain('Open');
      expect(validStatuses).toContain('In Progress');
      expect(validStatuses).toContain('Closed');
    });
  });

  describe('Overdue Detection', () => {
    const isOverdue = (targetDate: Date, status: string) => {
      if (status === 'Closed') return false;
      return targetDate < new Date();
    };

    it('should detect overdue CAPAs', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      expect(isOverdue(pastDate, 'Open')).toBe(true);
    });

    it('should not flag closed CAPAs as overdue', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      expect(isOverdue(pastDate, 'Closed')).toBe(false);
    });

    it('should not flag future CAPAs as overdue', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      expect(isOverdue(futureDate, 'Open')).toBe(false);
    });
  });
});
