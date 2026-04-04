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
  const roleRoutes = require('../routes/role.routes').default;
  app.use('/api/v1/roles', roleRoutes);
  app.use(errorHandler);
  return app;
};

// Helper to create auth token
const createToken = (userId: number) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!);
};

// Mock user data for different roles
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

const mockViewer = {
  id: 3,
  email: 'viewer@protecther.in',
  name: 'Viewer User',
  role_id: 6,
  role_name: 'Viewer',
  package_id: 1,
};

describe('Role API', () => {
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

  describe('Authorization Middleware', () => {
    it('should allow Super Admin to access admin routes', async () => {
      const token = createToken(1);

      // Mock auth middleware queries
      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any); // default project
      // Mock create role queries
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any); // check existing
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 7, name: 'New Role', permissions: {} }],
      } as any);

      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Role', permissions: { read: true } });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should deny Auditor access to admin-only routes', async () => {
      const token = createToken(2);

      // Mock auth middleware queries
      mockDb.query.mockResolvedValueOnce({ rows: [mockAuditor] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Role', permissions: {} });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Not authorized to access this resource');
    });

    it('should deny Viewer access to admin-only routes', async () => {
      const token = createToken(3);

      // Mock auth middleware queries
      mockDb.query.mockResolvedValueOnce({ rows: [mockViewer] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .delete('/api/v1/roles/5')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Not authorized to access this resource');
    });

    it('should allow any authenticated user to read roles', async () => {
      const token = createToken(3);

      // Mock auth middleware queries
      mockDb.query.mockResolvedValueOnce({ rows: [mockViewer] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      // Mock getAll query
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Super Admin', permissions: { all: true }, user_count: '1', created_at: new Date() },
          { id: 2, name: 'Auditor', permissions: { audit: true }, user_count: '5', created_at: new Date() },
        ],
      } as any);

      const res = await request(app)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/v1/roles', () => {
    it('should return all roles with user counts', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Super Admin', permissions: { all: true }, user_count: '1', created_at: new Date() },
          { id: 2, name: 'PMC Head', permissions: { approve: true }, user_count: '2', created_at: new Date() },
          { id: 3, name: 'Package Manager', permissions: { manage: true }, user_count: '3', created_at: new Date() },
        ],
      } as any);

      const res = await request(app)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data[0].userCount).toBe(1);
      expect(res.body.data[1].name).toBe('PMC Head');
    });
  });

  describe('GET /api/v1/roles/:id', () => {
    it('should return role by ID', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Super Admin', permissions: { all: true }, created_at: new Date() }],
      } as any);

      const res = await request(app)
        .get('/api/v1/roles/1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Super Admin');
    });

    it('should return 404 for non-existent role', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .get('/api/v1/roles/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Role not found');
    });
  });

  describe('POST /api/v1/roles', () => {
    it('should create role successfully', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any); // check existing
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 7, name: 'Custom Role', permissions: { custom: true } }],
      } as any);

      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Custom Role', permissions: { custom: true } });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Custom Role');
    });

    it('should reject duplicate role name', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 1 }] } as any); // existing role

      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Super Admin', permissions: {} });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Role name already exists');
    });
  });

  describe('PUT /api/v1/roles/:id', () => {
    it('should update role successfully', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 5 }] } as any); // role exists
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any); // no duplicate name
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any); // update

      const res = await request(app)
        .put('/api/v1/roles/5')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Role', permissions: { updated: true } });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Role updated successfully');
    });

    it('should return 404 for non-existent role', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any); // role not found

      const res = await request(app)
        .put('/api/v1/roles/999')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Role' });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Role not found');
    });
  });

  describe('DELETE /api/v1/roles/:id', () => {
    it('should delete role without users', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }] } as any); // no users
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any); // delete

      const res = await request(app)
        .delete('/api/v1/roles/7')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Role deleted successfully');
    });

    it('should prevent deleting role with assigned users', async () => {
      const token = createToken(1);

      mockDb.query.mockResolvedValueOnce({ rows: [mockSuperAdmin] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '5' }] } as any); // has users

      const res = await request(app)
        .delete('/api/v1/roles/2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Cannot delete role with assigned users');
    });
  });
});

describe('Role Hierarchy', () => {
  const roles = [
    { id: 1, name: 'Super Admin', level: 1 },
    { id: 2, name: 'PMC Head', level: 2 },
    { id: 3, name: 'Package Manager', level: 3 },
    { id: 4, name: 'Auditor', level: 4 },
    { id: 5, name: 'Contractor', level: 5 },
    { id: 6, name: 'Viewer', level: 6 },
  ];

  it('should have 6 predefined roles in correct hierarchy', () => {
    expect(roles).toHaveLength(6);
    expect(roles[0].name).toBe('Super Admin');
    expect(roles[5].name).toBe('Viewer');
  });

  it('should have Super Admin at highest level', () => {
    const superAdmin = roles.find(r => r.name === 'Super Admin');
    expect(superAdmin?.level).toBe(1);
  });
});
