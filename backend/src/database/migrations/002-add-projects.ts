import { db } from '../connection';
import { logger } from '../../utils/logger';

/**
 * Migration to add multi-project support
 * This migration:
 * 1. Creates the projects table
 * 2. Creates user_project_assignments table
 * 3. Adds project_id column to packages
 * 4. Creates a default "MAHSR" project
 * 5. Links existing packages to the default project
 * 6. Assigns all existing users to the default project
 */
async function migrate() {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    logger.info('Starting migration: 002-add-projects');

    // Check if projects table already exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'projects'
      )
    `);

    if (tableCheck.rows[0].exists) {
      logger.info('Projects table already exists, skipping migration');
      await client.query('COMMIT');
      process.exit(0);
    }

    // 1. Create projects table
    logger.info('Creating projects table...');
    await client.query(`
      CREATE TABLE projects (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        client_name VARCHAR(255),
        location VARCHAR(255),
        start_date DATE,
        end_date DATE,
        status VARCHAR(20) DEFAULT 'Active',
        settings JSONB DEFAULT '{}',
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Create user_project_assignments table
    logger.info('Creating user_project_assignments table...');
    await client.query(`
      CREATE TABLE user_project_assignments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        is_default BOOLEAN DEFAULT false,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, project_id)
      )
    `);

    // 3. Create the default MAHSR project
    logger.info('Creating default MAHSR project...');
    const projectResult = await client.query(`
      INSERT INTO projects (code, name, description, client_name, location, start_date)
      VALUES (
        'MAHSR',
        'Mumbai-Ahmedabad High Speed Rail',
        'India''s first high-speed rail corridor connecting Mumbai and Ahmedabad',
        'NHSRCL',
        'Mumbai to Ahmedabad, India',
        '2017-09-14'
      )
      RETURNING id
    `);
    const defaultProjectId = projectResult.rows[0].id;
    logger.info(`Default project created with ID: ${defaultProjectId}`);

    // 4. Add project_id column to packages (nullable first)
    logger.info('Adding project_id column to packages...');
    await client.query(`
      ALTER TABLE packages ADD COLUMN project_id INTEGER REFERENCES projects(id)
    `);

    // 5. Link all existing packages to the default project
    logger.info('Linking existing packages to default project...');
    await client.query(`
      UPDATE packages SET project_id = $1
    `, [defaultProjectId]);

    // 6. Make project_id NOT NULL
    logger.info('Making project_id NOT NULL...');
    await client.query(`
      ALTER TABLE packages ALTER COLUMN project_id SET NOT NULL
    `);

    // 7. Drop unique constraint on code, add composite unique
    logger.info('Updating packages unique constraint...');
    await client.query(`
      ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_code_key
    `);
    await client.query(`
      ALTER TABLE packages ADD CONSTRAINT packages_project_code_unique UNIQUE(project_id, code)
    `);

    // 8. Assign all existing users to the default project
    logger.info('Assigning existing users to default project...');
    await client.query(`
      INSERT INTO user_project_assignments (user_id, project_id, is_default)
      SELECT id, $1, true FROM users
    `, [defaultProjectId]);

    // 9. Create indexes
    logger.info('Creating indexes...');
    await client.query(`
      CREATE INDEX idx_projects_status ON projects(status);
      CREATE INDEX idx_packages_project_id ON packages(project_id);
      CREATE INDEX idx_user_project_user ON user_project_assignments(user_id);
      CREATE INDEX idx_user_project_project ON user_project_assignments(project_id);
    `);

    await client.query('COMMIT');
    logger.info('Migration 002-add-projects completed successfully!');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();
