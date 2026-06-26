import bcrypt from 'bcryptjs';
import { db } from './connection';
import { logger } from '../utils/logger';

async function seed() {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.FORCE_SEED !== 'true') {
      logger.error(
        'Refusing to seed in production. Seeding inserts demo users with well-known passwords. Set FORCE_SEED=true to override.'
      );
      process.exit(1);
    }

    logger.warn(
      'Seeding DEMO data with well-known passwords (admin123 / demo123). For development use only — never expose a seeded database publicly.'
    );

    logger.info('Starting database seeding...');

    // NOTE: The audit checklist (categories, sections, items) is NOT seeded here.
    // It is the real client checklist and is loaded from the MAHSR workbook via:
    //   npx ts-node src/database/reload-checklist.ts
    // The previous hardcoded placeholder checklist (18 categories / ~202 sample
    // items) was removed so re-running this seed can never re-introduce it. The
    // sample audits below will reference whatever real checklist has been loaded.

    // Seed Roles
    await db.query(`
      INSERT INTO roles (name, permissions) VALUES
      ('Super Admin', '{"all": true}'),
      ('PMC Head', '{"audits": ["view", "approve"], "reports": ["view", "export"], "kpi": ["view", "edit"]}'),
      ('Package Manager', '{"audits": ["create", "edit", "view", "submit"], "reports": ["view"], "capa": ["manage"]}'),
      ('Auditor', '{"audits": ["create", "edit", "view", "submit"], "capa": ["view"]}'),
      ('Contractor', '{"audits": ["view"], "capa": ["respond"]}'),
      ('Viewer', '{"audits": ["view"], "reports": ["view"], "dashboard": ["view"]}')
      ON CONFLICT (name) DO NOTHING
    `);
    logger.info('Roles seeded');

    // Seed Default Project (Sample)
    const projectResult = await db.query(`
      INSERT INTO projects (code, name, description, client_name, location, start_date)
      VALUES (
        'SAMPLE',
        'Sample Construction Project',
        'A sample construction project for demonstration purposes',
        'Sample Client',
        'India',
        '2024-01-01'
      )
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const defaultProjectId = projectResult.rows[0].id;
    logger.info(`Default project seeded with ID: ${defaultProjectId}`);

    // Seed Packages (linked to default project)
    await db.query(`
      INSERT INTO packages (project_id, code, name, location, contractor_name) VALUES
      ($1, 'C1', 'Vadodara Corridor', 'Vadodara, Gujarat', 'L&T Construction'),
      ($1, 'C2', 'BKC Underground', 'Mumbai, Maharashtra', 'Afcons Infrastructure'),
      ($1, 'C3', 'Thane Region', 'Thane, Maharashtra', 'Tata Projects'),
      ($1, 'C4', 'Gujarat Corridor North', 'Anand-Vadodara', 'J Kumar Infra'),
      ($1, 'C5', 'Gujarat Corridor South', 'Surat Region', 'NCC Limited'),
      ($1, 'C6', 'Surat Region', 'Surat, Gujarat', 'Dilip Buildcon'),
      ($1, 'C7', 'Ahmedabad Terminal', 'Ahmedabad, Gujarat', 'Shapoorji Pallonji')
      ON CONFLICT (project_id, code) DO NOTHING
    `, [defaultProjectId]);
    logger.info('Packages seeded');

    // Seed Admin User
    const passwordHash = await bcrypt.hash('admin123', 12);
    await db.query(`
      INSERT INTO users (email, password_hash, name, role_id, is_active)
      VALUES ('admin@protecther.com', $1, 'System Admin', 1, true)
      ON CONFLICT (email) DO NOTHING
    `, [passwordHash]);

    // Seed Demo Users
    const demoPassword = await bcrypt.hash('demo123', 12);
    await db.query(`
      INSERT INTO users (email, password_hash, name, role_id, package_id, is_active) VALUES
      ('pmchead@protecther.com', $1, 'PMC Head User', 2, NULL, true),
      ('manager.c2@protecther.com', $1, 'Package Manager C2', 3, 2, true),
      ('auditor1@protecther.com', $1, 'Rajesh Kumar', 4, 2, true),
      ('auditor2@protecther.com', $1, 'Priya Sharma', 4, 3, true),
      ('contractor.c2@protecther.com', $1, 'Contractor C2', 5, 2, true)
      ON CONFLICT (email) DO NOTHING
    `, [demoPassword]);
    logger.info('Users seeded');

    // Assign only the seeded demo users to the default project (never touch
    // real users that may already exist in the database)
    await db.query(`
      INSERT INTO user_project_assignments (user_id, project_id, is_default)
      SELECT id, $1, true FROM users
      WHERE email IN (
        'admin@protecther.com',
        'pmchead@protecther.com',
        'manager.c2@protecther.com',
        'auditor1@protecther.com',
        'auditor2@protecther.com',
        'contractor.c2@protecther.com'
      )
      ON CONFLICT (user_id, project_id) DO NOTHING
    `, [defaultProjectId]);
    logger.info('User project assignments seeded');

    // Seed KPI Indicators
    await db.query(`
      INSERT INTO kpi_indicators (type, category, name, definition, formula, unit, benchmark_value, display_order) VALUES
      ('Leading', 'Proactive Monitoring', 'Safety Inspections Completed', 'Number of planned inspections vs completed', NULL, '%', 100, 1),
      ('Leading', 'Proactive Monitoring', 'Hazard Observations Reported', 'Number of hazards reported by workers per month', NULL, '/month', NULL, 2),
      ('Leading', 'Proactive Monitoring', 'Near Miss Reports', 'Number of near miss incidents reported', NULL, '/month', NULL, 3),
      ('Leading', 'Training', 'Induction Completion Rate', 'Workers inducted vs total new workers', NULL, '%', 100, 4),
      ('Leading', 'Training', 'TBT Attendance', 'Toolbox Talk attendance percentage', NULL, '%', 95, 5),
      ('Leading', 'Process', 'PTW Compliance Rate', 'Permits closed properly vs issued', NULL, '%', 100, 6),
      ('Leading', 'Process', 'CAPA Closure Rate', 'CAPAs closed on time vs total', NULL, '%', 90, 7),
      ('Lagging', 'Incident Rates', 'Lost Time Injury Frequency Rate (LTIFR)', 'Lost time injuries per million man-hours', '(LTI x 1,000,000) / Man-hours worked', NULL, 0.5, 1),
      ('Lagging', 'Incident Rates', 'Total Recordable Injury Frequency Rate (TRIFR)', 'Total recordable injuries per million man-hours', '(TRI x 1,000,000) / Man-hours worked', NULL, 1.0, 2),
      ('Lagging', 'Incident Rates', 'Fatality Rate', 'Fatalities per 100,000 workers', 'Fatalities x 100,000 / Workers', NULL, 0, 3),
      ('Lagging', 'Incident Rates', 'Severity Rate', 'Lost days per million man-hours', '(Lost days x 1,000,000) / Man-hours', NULL, NULL, 4),
      ('Lagging', 'Work Hours', 'Man-hours Worked', 'Total man-hours worked in period', NULL, 'hours', NULL, 5),
      ('Lagging', 'Achievement', 'Days Without LTI', 'Consecutive days without lost time injury', NULL, 'days', NULL, 6)
      ON CONFLICT (type, category, name) DO NOTHING
    `);
    logger.info('KPI Indicators seeded');

    // Seed Sample Audits
    // These reference whatever audit checklist has been loaded via
    // reload-checklist.ts. If no checklist is present, the audits are created
    // but category selections / responses below simply insert nothing.
    logger.info('Seeding sample audits...');

    // Get user and package IDs for creating audits
    const auditorResult = await db.query("SELECT id FROM users WHERE email = 'auditor1@protecther.com'");
    const reviewerResult = await db.query("SELECT id FROM users WHERE email = 'manager.c2@protecther.com'");
    const package2Result = await db.query("SELECT id FROM packages WHERE code = 'C2' AND project_id = $1", [defaultProjectId]);
    const package3Result = await db.query("SELECT id FROM packages WHERE code = 'C3' AND project_id = $1", [defaultProjectId]);

    if (auditorResult.rows.length > 0 && package2Result.rows.length > 0) {
      const auditorId = auditorResult.rows[0].id;
      const reviewerId = reviewerResult.rows[0]?.id || auditorId;
      const pkg2Id = package2Result.rows[0].id;
      const pkg3Id = package3Result.rows[0]?.id || pkg2Id;

      // Completed audit with responses
      await db.query(`
        INSERT INTO audits (audit_number, package_id, audit_type, auditor_id, reviewer_id, contractor_rep,
          scheduled_date, audit_date, status, total_items, compliant_count, non_compliant_count, na_count,
          compliance_percentage, completed_at, approved_at, approved_by)
        VALUES
        ('AUD-2024-001', $1, 'Routine', $2, $3, 'Mr. Ramesh Patel',
          '2024-01-15', '2024-01-15', 'Approved', 50, 42, 5, 3, 89.36,
          '2024-01-15 17:00:00', '2024-01-16 10:00:00', $3),
        ('AUD-2024-002', $1, 'Routine', $2, $3, 'Mr. Ramesh Patel',
          '2024-02-10', '2024-02-10', 'Completed', 45, 38, 4, 3, 90.48,
          '2024-02-10 16:30:00', NULL, NULL),
        ('AUD-2024-003', $4, 'Scheduled', $2, $3, 'Ms. Sneha Reddy',
          '2024-02-20', '2024-02-20', 'Pending Review', 40, 35, 3, 2, 92.11,
          '2024-02-20 15:00:00', NULL, NULL),
        ('AUD-2024-004', $1, 'Follow-up', $2, $3, 'Mr. Ramesh Patel',
          '2024-03-01', '2024-03-01', 'In Progress', 30, 20, 2, 0, 90.91,
          NULL, NULL, NULL),
        ('AUD-2024-005', $4, 'Routine', $2, NULL, 'Mr. Vikram Singh',
          '2024-03-15', NULL, 'Draft', 0, 0, 0, 0, NULL,
          NULL, NULL, NULL)
        ON CONFLICT (audit_number) DO NOTHING
      `, [pkg2Id, auditorId, reviewerId, pkg3Id]);

      // Add category selections for audits
      const audit1Result = await db.query("SELECT id FROM audits WHERE audit_number = 'AUD-2024-001'");
      const audit4Result = await db.query("SELECT id FROM audits WHERE audit_number = 'AUD-2024-004'");

      if (audit1Result.rows.length > 0) {
        const audit1Id = audit1Result.rows[0].id;
        await db.query(`
          INSERT INTO audit_category_selection (audit_id, category_id)
          SELECT $1, id FROM audit_categories WHERE code IN ('01', '02', '03', '04', '05')
          ON CONFLICT (audit_id, category_id) DO NOTHING
        `, [audit1Id]);

        // Add sample responses for audit 1
        const itemsResult = await db.query(`
          SELECT ai.id FROM audit_items ai
          JOIN audit_sections s ON ai.section_id = s.id
          JOIN audit_categories c ON s.category_id = c.id
          WHERE c.code = '01'
          ORDER BY ai.sr_no
          LIMIT 10
        `);

        for (let i = 0; i < itemsResult.rows.length; i++) {
          const itemId = itemsResult.rows[i].id;
          const statuses = ['C', 'C', 'C', 'C', 'NC', 'C', 'C', 'NA', 'C', 'NC'];
          const status = statuses[i] || 'C';
          const observation = status === 'NC' ? 'Non-compliance observed. Immediate corrective action required.' :
                            status === 'NA' ? 'Not applicable for this site.' : null;
          const capaRequired = status === 'NC';

          await db.query(`
            INSERT INTO audit_responses (audit_id, audit_item_id, status, observation, capa_required, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (audit_id, audit_item_id) DO NOTHING
          `, [audit1Id, itemId, status, observation, capaRequired, auditorId]);
        }
      }

      if (audit4Result.rows.length > 0) {
        const audit4Id = audit4Result.rows[0].id;
        await db.query(`
          INSERT INTO audit_category_selection (audit_id, category_id)
          SELECT $1, id FROM audit_categories WHERE code IN ('05', '08')
          ON CONFLICT (audit_id, category_id) DO NOTHING
        `, [audit4Id]);
      }
    }
    logger.info('Sample audits seeded');

    // Seed Sample CAPAs
    logger.info('Seeding sample CAPAs...');
    const ncResponsesResult = await db.query(`
      SELECT ar.id, ar.observation FROM audit_responses ar
      WHERE ar.status = 'NC' AND ar.capa_required = true
      LIMIT 3
    `);

    for (let i = 0; i < ncResponsesResult.rows.length; i++) {
      const response = ncResponsesResult.rows[i];
      const capaNumber = `CAPA-2024-${String(i + 1).padStart(3, '0')}`;
      const statuses = ['Closed', 'In Progress', 'Open'];
      const status = statuses[i] || 'Open';

      await db.query(`
        INSERT INTO capa (capa_number, response_id, finding_description, root_cause, corrective_action,
          preventive_action, responsible_person, responsible_dept, target_date, status, closed_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (capa_number) DO NOTHING
      `, [
        capaNumber,
        response.id,
        response.observation || 'Non-compliance identified during safety audit',
        i === 0 ? 'Lack of awareness about statutory requirement' : null,
        i === 0 ? 'Obtained registration certificate and displayed at site' : i === 1 ? 'Training scheduled for all supervisors' : null,
        i === 0 ? 'Added to monthly compliance checklist' : null,
        ['Mr. Suresh Kumar', 'Ms. Priya Nair', 'Mr. Amit Shah'][i],
        ['Safety', 'HR', 'Operations'][i],
        new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status,
        status === 'Closed' ? '2024-01-25' : null
      ]);
    }
    logger.info('Sample CAPAs seeded');

    // Seed Sample KPI Entries
    logger.info('Seeding sample KPI entries...');
    const indicatorsResult = await db.query("SELECT id, name FROM kpi_indicators LIMIT 7");
    const packagesResult = await db.query("SELECT id FROM packages LIMIT 3");
    const kpiUserId = auditorResult.rows[0]?.id || 1;

    for (const pkg of packagesResult.rows) {
      for (const indicator of indicatorsResult.rows) {
        // Add entries for last 3 months
        for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
          const date = new Date();
          date.setMonth(date.getMonth() - monthOffset);
          const month = date.getMonth() + 1;
          const year = date.getFullYear();

          let targetValue = null;
          let actualValue = null;
          let manHours = null;
          let incidents = null;

          // Set values based on indicator type
          if (indicator.name.includes('Rate') || indicator.name.includes('%')) {
            targetValue = 95 + Math.random() * 5;
            actualValue = 85 + Math.random() * 15;
          } else if (indicator.name.includes('LTIFR')) {
            targetValue = 0.5;
            actualValue = Math.random() * 0.8;
            manHours = 500000 + Math.floor(Math.random() * 200000);
            incidents = Math.floor(Math.random() * 3);
          } else if (indicator.name.includes('Man-hours')) {
            actualValue = 500000 + Math.floor(Math.random() * 300000);
            manHours = actualValue;
          } else if (indicator.name.includes('Days Without')) {
            actualValue = 30 + Math.floor(Math.random() * 60);
          } else {
            actualValue = 10 + Math.floor(Math.random() * 40);
          }

          await db.query(`
            INSERT INTO kpi_entries (package_id, indicator_id, period_month, period_year,
              target_value, actual_value, man_hours_worked, incidents_count, entered_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (package_id, indicator_id, period_month, period_year) DO NOTHING
          `, [pkg.id, indicator.id, month, year, targetValue, actualValue, manHours, incidents, kpiUserId]);
        }
      }
    }
    logger.info('Sample KPI entries seeded');

    logger.info('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
