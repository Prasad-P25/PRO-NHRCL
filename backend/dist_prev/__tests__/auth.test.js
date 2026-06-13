"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Mock the database before importing app
jest.mock('../database/connection', () => ({
    db: {
        query: jest.fn(),
    },
}));
// Mock the logger to avoid console spam
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));
// Mock email service
jest.mock('../services/email.service', () => ({
    emailService: {
        sendPasswordReset: jest.fn().mockResolvedValue(true),
    },
}));
// Mock rate limiter to disable it in tests
jest.mock('../middleware/rateLimiter', () => ({
    authLimiter: (req, res, next) => next(),
    apiLimiter: (req, res, next) => next(),
    uploadLimiter: (req, res, next) => next(),
}));
const connection_1 = require("../database/connection");
const tokenBlacklist_1 = require("../utils/tokenBlacklist");
const errorHandler_1 = require("../middleware/errorHandler");
// Create a minimal test app
const createTestApp = () => {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // Import routes after mocking
    const authRoutes = require('../routes/auth.routes').default;
    app.use('/api/v1/auth', authRoutes);
    // Add error handler
    app.use(errorHandler_1.errorHandler);
    return app;
};
const mockDb = connection_1.db;
describe('Auth API', () => {
    let app;
    beforeAll(() => {
        process.env.JWT_SECRET = 'test-secret-key';
        process.env.JWT_EXPIRES_IN = '24h';
        app = createTestApp();
    });
    afterAll(() => {
        jest.clearAllTimers();
    });
    beforeEach(() => {
        jest.clearAllMocks();
        tokenBlacklist_1.tokenBlacklist.clear();
    });
    describe('POST /api/v1/auth/login', () => {
        const validUser = {
            id: 1,
            email: 'admin@protecther.in',
            name: 'Admin User',
            password_hash: bcryptjs_1.default.hashSync('admin123', 12),
            role_id: 1,
            role_name: 'Super Admin',
            permissions: { all: true },
            package_id: null,
            is_active: true,
        };
        it('should login successfully with valid credentials', async () => {
            mockDb.query.mockResolvedValueOnce({ rows: [validUser] });
            mockDb.query.mockResolvedValueOnce({ rows: [] }); // Update last login
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/login')
                .send({ email: 'admin@protecther.in', password: 'admin123' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBeDefined();
            expect(res.body.data.user.email).toBe('admin@protecther.in');
            expect(res.body.data.user.role.name).toBe('Super Admin');
        });
        it('should reject invalid email format', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/login')
                .send({ email: 'not-an-email', password: 'admin123' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject empty password', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/login')
                .send({ email: 'admin@protecther.in', password: '' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject non-existent user', async () => {
            mockDb.query.mockResolvedValueOnce({ rows: [] });
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/login')
                .send({ email: 'nonexistent@test.com', password: 'password123' });
            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Invalid email or password');
        });
        it('should reject wrong password', async () => {
            mockDb.query.mockResolvedValueOnce({ rows: [validUser] });
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/login')
                .send({ email: 'admin@protecther.in', password: 'wrongpassword' });
            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Invalid email or password');
        });
        it('should reject inactive user', async () => {
            const inactiveUser = { ...validUser, is_active: false };
            mockDb.query.mockResolvedValueOnce({ rows: [inactiveUser] });
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/login')
                .send({ email: 'admin@protecther.in', password: 'admin123' });
            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Account is inactive');
        });
    });
    describe('POST /api/v1/auth/logout', () => {
        it('should logout successfully with valid token', async () => {
            const token = jsonwebtoken_1.default.sign({ userId: 1 }, process.env.JWT_SECRET);
            // Mock user lookup for authenticate middleware
            mockDb.query.mockResolvedValueOnce({
                rows: [{
                        id: 1,
                        email: 'admin@protecther.in',
                        name: 'Admin User',
                        role_id: 1,
                        role_name: 'Super Admin',
                        package_id: null,
                    }],
            });
            // Mock default project lookup (auth middleware second query)
            mockDb.query.mockResolvedValueOnce({ rows: [] });
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Logged out successfully');
            expect(tokenBlacklist_1.tokenBlacklist.isBlacklisted(token)).toBe(true);
        });
        it('should reject logout without token', async () => {
            const res = await (0, supertest_1.default)(app).post('/api/v1/auth/logout');
            expect(res.status).toBe(401);
        });
    });
    describe('POST /api/v1/auth/refresh', () => {
        it('should refresh token successfully', async () => {
            const oldToken = jsonwebtoken_1.default.sign({ userId: 1 }, process.env.JWT_SECRET);
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/refresh')
                .set('Authorization', `Bearer ${oldToken}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBeDefined();
            expect(res.body.data.token).not.toBe(oldToken);
        });
        it('should reject refresh with blacklisted token', async () => {
            const blacklistedToken = jsonwebtoken_1.default.sign({ userId: 1 }, process.env.JWT_SECRET);
            tokenBlacklist_1.tokenBlacklist.add(blacklistedToken, 60000);
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/refresh')
                .set('Authorization', `Bearer ${blacklistedToken}`);
            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Token has been revoked');
        });
        it('should reject refresh without token', async () => {
            const res = await (0, supertest_1.default)(app).post('/api/v1/auth/refresh');
            expect(res.status).toBe(401);
            expect(res.body.message).toBe('No token provided');
        });
    });
    describe('POST /api/v1/auth/forgot-password', () => {
        it('should send reset email for existing user', async () => {
            mockDb.query
                .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test User' }] }) // Find user
                .mockResolvedValueOnce({ rows: [] }); // Save token
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/forgot-password')
                .send({ email: 'test@protecther.in' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('If the email exists');
        });
        it('should return success even for non-existent email (prevents enumeration)', async () => {
            mockDb.query.mockResolvedValueOnce({ rows: [] });
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/forgot-password')
                .send({ email: 'nonexistent@test.com' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should reject invalid email format', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/forgot-password')
                .send({ email: 'not-an-email' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    describe('POST /api/v1/auth/reset-password', () => {
        it('should reset password with valid token', async () => {
            mockDb.query
                .mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@protecther.in' }] }) // Find user with valid token
                .mockResolvedValueOnce({ rows: [] }); // Update password
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/reset-password')
                .send({ token: 'valid-reset-token', password: 'newpassword123' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('Password has been reset');
        });
        it('should reject invalid/expired token', async () => {
            mockDb.query.mockResolvedValueOnce({ rows: [] });
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/reset-password')
                .send({ token: 'invalid-token', password: 'newpassword123' });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Invalid or expired reset token');
        });
        it('should reject password less than 6 characters', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/reset-password')
                .send({ token: 'some-token', password: '123' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject missing token', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/auth/reset-password')
                .send({ password: 'newpassword123' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
});
describe('Token Blacklist', () => {
    beforeEach(() => {
        tokenBlacklist_1.tokenBlacklist.clear();
    });
    it('should blacklist a token', () => {
        const token = 'test-token';
        tokenBlacklist_1.tokenBlacklist.add(token, 60000);
        expect(tokenBlacklist_1.tokenBlacklist.isBlacklisted(token)).toBe(true);
    });
    it('should return false for non-blacklisted token', () => {
        expect(tokenBlacklist_1.tokenBlacklist.isBlacklisted('random-token')).toBe(false);
    });
});
//# sourceMappingURL=auth.test.js.map