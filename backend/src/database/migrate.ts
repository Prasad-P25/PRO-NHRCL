import { db } from './connection';
import { logger } from '../utils/logger';

const schema = `
-- Drop tables if exist (in reverse order of dependencies)
DROP TABLE IF EXISTS generated_reports CASCADE;
DROP TABLE IF EXISTS scheduled_reports CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS maturity_responses CASCADE;
DROP TABLE IF EXISTS maturity_assessments CASCADE;
DROP TABLE IF EXISTS kpi_entries CASCADE;
DROP TABLE IF EXISTS kpi_indicators CASCADE;
DROP TABLE IF EXISTS capa CASCADE;
DROP TABLE IF EXISTS audit_evidences CASCADE;
DROP TABLE IF EXISTS audit_responses CASCADE;
DROP TABLE IF EXISTS audit_category_selection CASCADE;
DROP TABLE IF EXISTS audits CASCADE;
DROP TABLE IF EXISTS audit_items CASCADE;
DROP TABLE IF EXISTS audit_sections CASCADE;
DROP TABLE IF EXISTS audit_categories CASCADE;
DROP TABLE IF EXISTS contractors CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS packages CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- Roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Packages
CREATE TABLE packages (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    description TEXT,
    contractor_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role_id INTEGER REFERENCES roles(id),
    package_id INTEGER REFERENCES packages(id),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Categories
CREATE TABLE audit_categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    full_title VARCHAR(255),
    description TEXT,
    type VARCHAR(50),
    applicable_standards TEXT,
    display_order INTEGER,
    is_active BOOLEAN DEFAULT true
);

-- Audit Sections
CREATE TABLE audit_sections (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES audit_categories(id),
    code VARCHAR(5) NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_order INTEGER,
    UNIQUE(category_id, code)
);

-- Audit Items
CREATE TABLE audit_items (
    id SERIAL PRIMARY KEY,
    section_id INTEGER REFERENCES audit_sections(id),
    sr_no INTEGER NOT NULL,
    audit_point TEXT NOT NULL,
    standard_reference TEXT,
    evidence_required TEXT,
    priority VARCHAR(5) DEFAULT 'P1',
    is_active BOOLEAN DEFAULT true,
    UNIQUE(section_id, sr_no)
);

-- Audits
CREATE TABLE audits (
    id SERIAL PRIMARY KEY,
    audit_number VARCHAR(50) NOT NULL UNIQUE,
    package_id INTEGER REFERENCES packages(id),
    audit_type VARCHAR(50),
    auditor_id INTEGER REFERENCES users(id),
    reviewer_id INTEGER REFERENCES users(id),
    contractor_rep VARCHAR(100),
    scheduled_date DATE,
    audit_date DATE,
    status VARCHAR(20) DEFAULT 'Draft',
    total_items INTEGER DEFAULT 0,
    compliant_count INTEGER DEFAULT 0,
    non_compliant_count INTEGER DEFAULT 0,
    na_count INTEGER DEFAULT 0,
    compliance_percentage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    approved_at TIMESTAMP,
    approved_by INTEGER REFERENCES users(id)
);

-- Audit Category Selection
CREATE TABLE audit_category_selection (
    id SERIAL PRIMARY KEY,
    audit_id INTEGER REFERENCES audits(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES audit_categories(id),
    UNIQUE(audit_id, category_id)
);

-- Audit Responses
CREATE TABLE audit_responses (
    id SERIAL PRIMARY KEY,
    audit_id INTEGER REFERENCES audits(id) ON DELETE CASCADE,
    audit_item_id INTEGER REFERENCES audit_items(id),
    status VARCHAR(5),
    observation TEXT,
    risk_rating VARCHAR(20),
    capa_required BOOLEAN DEFAULT false,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(audit_id, audit_item_id)
);

-- Audit Evidences
CREATE TABLE audit_evidences (
    id SERIAL PRIMARY KEY,
    response_id INTEGER REFERENCES audit_responses(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CAPA
CREATE TABLE capa (
    id SERIAL PRIMARY KEY,
    capa_number VARCHAR(50) NOT NULL UNIQUE,
    response_id INTEGER REFERENCES audit_responses(id),
    finding_description TEXT NOT NULL,
    root_cause TEXT,
    corrective_action TEXT,
    preventive_action TEXT,
    responsible_person VARCHAR(100),
    responsible_dept VARCHAR(100),
    target_date DATE,
    status VARCHAR(20) DEFAULT 'Open',
    closed_date DATE,
    verified_by INTEGER REFERENCES users(id),
    verification_remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- KPI Indicators
CREATE TABLE kpi_indicators (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20),
    category VARCHAR(100),
    name VARCHAR(100) NOT NULL,
    definition TEXT,
    formula TEXT,
    unit VARCHAR(20),
    benchmark_value DECIMAL(10,2),
    display_order INTEGER,
    UNIQUE(type, category, name)
);

-- KPI Entries
CREATE TABLE kpi_entries (
    id SERIAL PRIMARY KEY,
    package_id INTEGER REFERENCES packages(id),
    indicator_id INTEGER REFERENCES kpi_indicators(id),
    period_month INTEGER,
    period_year INTEGER,
    target_value DECIMAL(10,2),
    actual_value DECIMAL(10,2),
    man_hours_worked BIGINT,
    incidents_count INTEGER,
    remarks TEXT,
    entered_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(package_id, indicator_id, period_month, period_year)
);

-- Maturity Assessments
CREATE TABLE maturity_assessments (
    id SERIAL PRIMARY KEY,
    package_id INTEGER REFERENCES packages(id),
    assessment_date DATE,
    assessor_id INTEGER REFERENCES users(id),
    overall_score DECIMAL(3,1),
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Maturity Responses
CREATE TABLE maturity_responses (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER REFERENCES maturity_assessments(id) ON DELETE CASCADE,
    dimension VARCHAR(100),
    question TEXT,
    score INTEGER CHECK (score >= 1 AND score <= 5),
    evidence TEXT,
    gap_identified TEXT,
    recommendations TEXT
);

-- Audit Logs
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50),
    entity_type VARCHAR(50),
    entity_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    from_user_id INTEGER REFERENCES users(id),
    entity_type VARCHAR(50),
    entity_id INTEGER,
    action_url VARCHAR(500),
    priority VARCHAR(20) DEFAULT 'normal',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled Reports
CREATE TABLE scheduled_reports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL DEFAULT 'pdf',
    filters JSONB DEFAULT '{}',
    schedule_type VARCHAR(20) NOT NULL,
    schedule_day INTEGER,
    schedule_time TIME DEFAULT '08:00:00',
    recipients JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generated Reports (history)
CREATE TABLE generated_reports (
    id SERIAL PRIMARY KEY,
    scheduled_report_id INTEGER REFERENCES scheduled_reports(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL,
    filters JSONB DEFAULT '{}',
    file_path VARCHAR(500),
    file_size INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    generated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_audits_package_id ON audits(package_id);
CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audits_auditor_id ON audits(auditor_id);
CREATE INDEX idx_audit_responses_audit_id ON audit_responses(audit_id);
CREATE INDEX idx_audit_responses_status ON audit_responses(status);
CREATE INDEX idx_capa_status ON capa(status);
CREATE INDEX idx_kpi_entries_package ON kpi_entries(package_id, period_year, period_month);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;
CREATE INDEX idx_generated_reports_schedule ON generated_reports(scheduled_report_id);
`;

async function migrate() {
  try {
    logger.info('Starting database migration...');

    await db.query(schema);

    logger.info('Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
