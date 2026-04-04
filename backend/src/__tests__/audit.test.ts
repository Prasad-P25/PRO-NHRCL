import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

// Mock database
jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
  },
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock rate limiter
jest.mock('../middleware/rateLimiter', () => ({
  authLimiter: (req: any, res: any, next: any) => next(),
  apiLimiter: (req: any, res: any, next: any) => next(),
  uploadLimiter: (req: any, res: any, next: any) => next(),
}));

import { db } from '../database/connection';
import { errorHandler } from '../middleware/errorHandler';
import { tokenBlacklist } from '../utils/tokenBlacklist';

const mockDb = db as jest.Mocked<typeof db>;

// Helper to create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  const auditRoutes = require('../routes/audit.routes').default;
  app.use('/api/v1/audits', auditRoutes);
  app.use(errorHandler);
  return app;
};

const createToken = (userId: number) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!);
};

// Mock users
const mockSuperAdmin = {
  id: 1,
  email: 'admin@protecther.in',
  name: 'Super Admin',
  role_id: 1,
  role_name: 'Super Admin',
  package_id: null,
};

const mockAuditor = {
  id: 2,
  email: 'auditor@protecther.in',
  name: 'Auditor User',
  role_id: 4,
  role_name: 'Auditor',
  package_id: 1,
};

const mockPMCHead = {
  id: 3,
  email: 'pmchead@protecther.in',
  name: 'PMC Head',
  role_id: 2,
  role_name: 'PMC Head',
  package_id: null,
};

// Sample audit data
const sampleAudit = {
  id: 1,
  audit_number: 'AUD-C1-2024-001',
  package_id: 1,
  auditor_id: 2,
  audit_type: 'Full',
  status: 'Draft',
  scheduled_date: new Date(),
  compliance_percentage: null,
  created_at: new Date(),
};

describe('Audit API', () => {
  let app: express.Application;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key';
    app = createTestApp();
  });

  afterAll(() => {
    jest.clearAllTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    tokenBlacklist.clear();
  });

  describe('GET /api/v1/audits', () => {
    it('should return paginated audits', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      // Count query
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '25' }] } as any);
      // Audits query
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { ...sampleAudit, package_name: 'Package C1', auditor_name: 'Auditor' },
          { ...sampleAudit, id: 2, audit_number: 'AUD-C1-2024-002' },
        ],
      } as any);

      const res = await request(app)
        .get('/api/v1/audits?page=1&pageSize=10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.total).toBe(25);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter audits by status', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '5' }] } as any);
      mockDb.query.mockResolvedValueOnce({
        rows: [{ ...sampleAudit, status: 'Approved' }],
      } as any);

      const res = await request(app)
        .get('/api/v1/audits?status=Approved')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].status).toBe('Approved');
    });
  });

  describe('POST /api/v1/audits', () => {
    it('should reject invalid audit type', async () => {
      const token = createToken(2);

      mockDb.query.mockResolvedValueOnce({ rows: [mockAuditor] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .post('/api/v1/audits')
        .set('Authorization', `Bearer ${token}`)
        .send({
          packageId: 1,
          auditType: 'Invalid',
          categoryIds: [1],
        });

      expect(res.status).toBe(400);
    });

    it('should reject missing package ID', async () => {
      const token = createToken(2);

      mockDb.query.mockResolvedValueOnce({ rows: [mockAuditor] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .post('/api/v1/audits')
        .set('Authorization', `Bearer ${token}`)
        .send({
          auditType: 'Full',
          categoryIds: [1],
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/audits/:id', () => {
    it('should return audit details', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          ...sampleAudit,
          package_name: 'Package C1',
          auditor_name: 'Auditor User',
        }],
      } as any);
      // Categories query
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Statutory Compliance' }],
      } as any);

      const res = await request(app)
        .get('/api/v1/audits/1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.auditNumber).toBe('AUD-C1-2024-001');
    });

    it('should return 404 for non-existent audit', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .get('/api/v1/audits/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Audit Workflow', () => {
    describe('POST /api/v1/audits/:id/submit', () => {
      it('should require authentication to submit', async () => {
        const res = await request(app)
          .post('/api/v1/audits/1/submit');

        expect(res.status).toBe(401);
      });
    });

    describe('POST /api/v1/audits/:id/approve', () => {
      it('should allow PMC Head to approve audit', async () => {
        const token = createToken(3);

        mockDb.query.mockResolvedValueOnce({ rows: [mockPMCHead] } as any);
        mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
        // Get audit
        mockDb.query.mockResolvedValueOnce({
          rows: [{ ...sampleAudit, status: 'Pending Review' }],
        } as any);
        // Update audit
        mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

        const res = await request(app)
          .post('/api/v1/audits/1/approve')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('approved');
      });

      it('should deny Auditor from approving', async () => {
        const token = createToken(2);

        mockDb.query.mockResolvedValueOnce({ rows: [mockAuditor] } as any);
        mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

        const res = await request(app)
          .post('/api/v1/audits/1/approve')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
      });
    });

    describe('POST /api/v1/audits/:id/reject', () => {
      it('should reject audit with reason', async () => {
        const token = createToken(3);

        mockDb.query.mockResolvedValueOnce({ rows: [mockPMCHead] } as any);
        mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
        mockDb.query.mockResolvedValueOnce({
          rows: [{ ...sampleAudit, status: 'Pending Review' }],
        } as any);
        mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

        const res = await request(app)
          .post('/api/v1/audits/1/reject')
          .set('Authorization', `Bearer ${token}`)
          .send({ reason: 'Missing evidence for several items' });

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('rejected');
      });
    });
  });

  describe('Audit Responses', () => {
    it('should require authentication to save responses', async () => {
      const res = await request(app)
        .post('/api/v1/audits/1/responses')
        .send({ responses: [] });

      expect(res.status).toBe(401);
    });

    it('should get audit responses', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { id: 1, item_id: 1, status: 'C', observation: 'All good' },
          { id: 2, item_id: 2, status: 'NC', observation: 'Issue found' },
        ],
      } as any);

      const res = await request(app)
        .get('/api/v1/audits/1/responses')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('Audit Comments', () => {
    it('should add comment to audit', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 1, audit_id: 1, user_id: 1, comment: 'Good work!', created_at: new Date() }],
      } as any);

      const res = await request(app)
        .post('/api/v1/audits/1/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ comment: 'Good work!' });

      expect(res.status).toBe(201);
    });
  });
});

describe('Audit Status Transitions', () => {
  const validTransitions = {
    'Draft': ['In Progress', 'Deleted'],
    'In Progress': ['Pending Review', 'Draft'],
    'Pending Review': ['Approved', 'Rejected'],
    'Rejected': ['In Progress'],
    'Approved': [], // Terminal state
  };

  it('should define valid status transitions', () => {
    expect(validTransitions['Draft']).toContain('In Progress');
    expect(validTransitions['Pending Review']).toContain('Approved');
    expect(validTransitions['Approved']).toHaveLength(0);
  });

  it('should not allow transition from Approved', () => {
    expect(validTransitions['Approved']).not.toContain('Draft');
    expect(validTransitions['Approved']).not.toContain('Rejected');
  });
});

describe('Compliance Calculation', () => {
  const calculateCompliance = (compliant: number, nonCompliant: number, na: number) => {
    const total = compliant + nonCompliant;
    if (total === 0) return null;
    return Math.round((compliant / total) * 100 * 10) / 10;
  };

  it('should calculate compliance correctly', () => {
    expect(calculateCompliance(80, 20, 0)).toBe(80);
    expect(calculateCompliance(95, 5, 10)).toBe(95);
    expect(calculateCompliance(0, 0, 100)).toBeNull();
  });
});
