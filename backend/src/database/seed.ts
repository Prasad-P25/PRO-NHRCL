import bcrypt from 'bcryptjs';
import { db } from './connection';
import { logger } from '../utils/logger';

async function seed() {
  try {
    logger.info('Starting database seeding...');

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

    // Seed Packages
    await db.query(`
      INSERT INTO packages (code, name, location, contractor_name) VALUES
      ('C1', 'Vadodara Corridor', 'Vadodara, Gujarat', 'L&T Construction'),
      ('C2', 'BKC Underground', 'Mumbai, Maharashtra', 'Afcons Infrastructure'),
      ('C3', 'Thane Region', 'Thane, Maharashtra', 'Tata Projects'),
      ('C4', 'Gujarat Corridor North', 'Anand-Vadodara', 'J Kumar Infra'),
      ('C5', 'Gujarat Corridor South', 'Surat Region', 'NCC Limited'),
      ('C6', 'Surat Region', 'Surat, Gujarat', 'Dilip Buildcon'),
      ('C7', 'Ahmedabad Terminal', 'Ahmedabad, Gujarat', 'Shapoorji Pallonji')
      ON CONFLICT (code) DO NOTHING
    `);
    logger.info('Packages seeded');

    // Seed Admin User
    const passwordHash = await bcrypt.hash('admin123', 12);
    await db.query(`
      INSERT INTO users (email, password_hash, name, role_id, is_active)
      VALUES ('admin@mahsr.com', $1, 'System Admin', 1, true)
      ON CONFLICT (email) DO NOTHING
    `, [passwordHash]);

    // Seed Demo Users
    const demoPassword = await bcrypt.hash('demo123', 12);
    await db.query(`
      INSERT INTO users (email, password_hash, name, role_id, package_id, is_active) VALUES
      ('pmchead@mahsr.com', $1, 'PMC Head User', 2, NULL, true),
      ('manager.c2@mahsr.com', $1, 'Package Manager C2', 3, 2, true),
      ('auditor1@mahsr.com', $1, 'Rajesh Kumar', 4, 2, true),
      ('auditor2@mahsr.com', $1, 'Priya Sharma', 4, 3, true),
      ('contractor.c2@mahsr.com', $1, 'Contractor C2', 5, 2, true)
      ON CONFLICT (email) DO NOTHING
    `, [demoPassword]);
    logger.info('Users seeded');

    // Seed Audit Categories
    await db.query(`
      INSERT INTO audit_categories (code, name, full_title, type, display_order, is_active) VALUES
      ('01', 'Statutory Compliance', 'STATUTORY & LEGAL COMPLIANCE AUDIT', 'Compliance', 1, true),
      ('02', 'SHE Management System', 'SAFETY, HEALTH & ENVIRONMENT MANAGEMENT SYSTEM', 'System', 2, true),
      ('03', 'HIRA & Risk Control', 'HAZARD IDENTIFICATION & RISK ASSESSMENT', 'Process', 3, true),
      ('04', 'Work Permits & LOTO', 'PERMIT TO WORK & LOCKOUT TAGOUT', 'Process', 4, true),
      ('05', 'Scaffolding & Height', 'SCAFFOLDING & WORK AT HEIGHT', 'Technical', 5, true),
      ('06', 'Excavation & Earthwork', 'EXCAVATION & EARTHWORK SAFETY', 'Technical', 6, true),
      ('07', 'Tunneling Safety', 'TUNNELING & UNDERGROUND WORK SAFETY', 'Technical', 7, true),
      ('08', 'Lifting & Cranes', 'LIFTING OPERATIONS & CRANE SAFETY', 'Technical', 8, true),
      ('09', 'Electrical Safety', 'ELECTRICAL SAFETY', 'Technical', 9, true),
      ('10', 'Fire & Emergency', 'FIRE PREVENTION & EMERGENCY PREPAREDNESS', 'Technical', 10, true),
      ('11', 'PPE & Welfare', 'PPE & WORKER WELFARE FACILITIES', 'Compliance', 11, true),
      ('12', 'Training & Competency', 'TRAINING & COMPETENCY MANAGEMENT', 'System', 12, true),
      ('13', 'Working Near IR Track', 'WORKING NEAR INDIAN RAILWAY TRACK', 'Technical', 13, true),
      ('14', 'Formwork & Temp Structures', 'FORMWORK & TEMPORARY STRUCTURES', 'Technical', 14, true),
      ('15', 'Bridge & Viaduct Works', 'BRIDGE & VIADUCT CONSTRUCTION', 'Technical', 15, true),
      ('16', 'Plant & Machinery', 'PLANT & MACHINERY SAFETY', 'Technical', 16, true),
      ('17', 'Material Handling', 'MATERIAL STORAGE & HANDLING', 'Process', 17, true),
      ('18', 'Incident Management', 'INCIDENT INVESTIGATION & REPORTING', 'System', 18, true)
      ON CONFLICT (code) DO NOTHING
    `);
    logger.info('Audit Categories seeded');

    // Seed sample sections and items for Category 1
    const cat1Result = await db.query("SELECT id FROM audit_categories WHERE code = '01'");
    if (cat1Result.rows.length > 0) {
      const cat1Id = cat1Result.rows[0].id;

      // All Sections for Statutory Compliance (A through G)
      await db.query(`
        INSERT INTO audit_sections (category_id, code, name, display_order) VALUES
        ($1, 'A', 'BOCW ACT 1996 & RULES 1998', 1),
        ($1, 'B', 'OTHER LABOUR LAWS', 2),
        ($1, 'C', 'ENVIRONMENTAL COMPLIANCE', 3),
        ($1, 'D', 'INSURANCE REQUIREMENTS', 4),
        ($1, 'E', 'PESO COMPLIANCE (Petroleum & Explosives)', 5),
        ($1, 'F', 'CPCB/SPCB COMPLIANCE', 6),
        ($1, 'G', 'MOTOR VEHICLE ACT COMPLIANCE', 7)
        ON CONFLICT (category_id, code) DO NOTHING
      `, [cat1Id]);

      // Section A - BOCW ACT items
      const sectionAResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'A'",
        [cat1Id]
      );
      if (sectionAResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'Registration of Establishment under BOCW Act', 'Section 7, BOCW Act', 'Registration Certificate', 'P1'),
          ($1, 2, 'Notice of Commencement of Work', 'Rule 21, BOCW Rules', 'Copy of Notice', 'P1'),
          ($1, 3, 'Employment of Building Workers Register', 'Form VII, BOCW Rules', 'Register inspection', 'P1'),
          ($1, 4, 'Muster Roll maintained in prescribed form', 'Rule 240, BOCW Rules', 'Muster Roll', 'P1'),
          ($1, 5, 'Register of Wages', 'Form XVI, BOCW Rules', 'Wage register', 'P1'),
          ($1, 6, 'Hours of Work compliance (max 48 hrs/week)', 'Section 28, BOCW Act', 'Work records', 'P1'),
          ($1, 7, 'Weekly holiday provided to workers', 'Section 29, BOCW Act', 'Holiday records', 'P1'),
          ($1, 8, 'Notice of Wages displayed', 'Rule 241, BOCW Rules', 'Physical verification', 'P2'),
          ($1, 9, 'Appointment of Safety Officer', 'Rule 209, BOCW Rules', 'Appointment letter', 'P1'),
          ($1, 10, 'Safety Committee constituted', 'Section 38, BOCW Act', 'Committee records', 'P1'),
          ($1, 11, 'First Aid facilities provided', 'Rule 230, BOCW Rules', 'Physical verification', 'P1'),
          ($1, 12, 'Canteen facilities (if >250 workers)', 'Rule 242, BOCW Rules', 'Physical verification', 'P2'),
          ($1, 13, 'Latrines and Urinals provided', 'Rule 243, BOCW Rules', 'Physical verification', 'P1'),
          ($1, 14, 'Drinking Water arrangement', 'Rule 244, BOCW Rules', 'Physical verification', 'P1'),
          ($1, 15, 'Creche facility (if >50 female workers)', 'Rule 245, BOCW Rules', 'Physical verification', 'P2'),
          ($1, 16, 'Welfare Cess paid', 'BOCW Welfare Cess Act', 'Cess receipts', 'P1'),
          ($1, 17, 'Register of Accidents maintained', 'Form XVIII, BOCW Rules', 'Accident register', 'P1')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sectionAResult.rows[0].id]);
      }

      // Section B - OTHER LABOUR LAWS items
      const sectionBResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'B'",
        [cat1Id]
      );
      if (sectionBResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'Contract Labour License (if applicable)', 'CLRA Act 1970', 'License copy', 'P1'),
          ($1, 2, 'EPF Registration & Compliance', 'EPF Act 1952', 'Registration & challans', 'P1'),
          ($1, 3, 'ESI Registration & Compliance', 'ESI Act 1948', 'Registration & challans', 'P1'),
          ($1, 4, 'Minimum Wages compliance', 'Minimum Wages Act 1948', 'Wage records', 'P1'),
          ($1, 5, 'Payment of Wages on time', 'Payment of Wages Act 1936', 'Payment records', 'P1'),
          ($1, 6, 'Equal Remuneration compliance', 'Equal Remuneration Act 1976', 'Wage records', 'P1'),
          ($1, 7, 'Child Labour prohibition verified', 'Child Labour Act 1986', 'Age verification records', 'P1'),
          ($1, 8, 'Workmen Compensation Insurance', 'WC Act 1923', 'Insurance policy', 'P1'),
          ($1, 9, 'Gratuity compliance (if applicable)', 'Payment of Gratuity Act 1972', 'Gratuity records', 'P2'),
          ($1, 10, 'Industrial Disputes compliance', 'Industrial Disputes Act 1947', 'Standing Orders', 'P2')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sectionBResult.rows[0].id]);
      }

      // Section C - ENVIRONMENTAL COMPLIANCE items
      const sectionCResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'C'",
        [cat1Id]
      );
      if (sectionCResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'Environmental Clearance obtained', 'EIA Notification 2006', 'EC copy', 'P1'),
          ($1, 2, 'Consent to Establish from SPCB/CPCB', 'Air/Water Act', 'CTE copy', 'P1'),
          ($1, 3, 'Consent to Operate from SPCB/CPCB', 'Air/Water Act', 'CTO copy', 'P1'),
          ($1, 4, 'Hazardous Waste authorization', 'HW Rules 2016', 'Authorization copy', 'P1'),
          ($1, 5, 'Air quality monitoring conducted', 'Air Act 1981', 'Monitoring reports', 'P1'),
          ($1, 6, 'Noise level monitoring conducted', 'Noise Rules 2000', 'Monitoring reports', 'P1'),
          ($1, 7, 'DG sets emission compliance', 'CPCB Guidelines', 'Stack monitoring reports', 'P1'),
          ($1, 8, 'Water quality monitoring conducted', 'Water Act 1974', 'Monitoring reports', 'P1')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sectionCResult.rows[0].id]);
      }

      // Section D - INSURANCE REQUIREMENTS items
      const sectionDResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'D'",
        [cat1Id]
      );
      if (sectionDResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'Contractor All Risk (CAR) Policy valid', 'Contract requirement', 'Policy copy', 'P1'),
          ($1, 2, 'Erection All Risk (EAR) Policy valid', 'Contract requirement', 'Policy copy', 'P1'),
          ($1, 3, 'Fire Insurance coverage adequate', 'Contract requirement', 'Policy copy', 'P1'),
          ($1, 4, 'STFI Coverage (Storm, Tempest, Flood, Inundation)', 'Contract requirement', 'Policy copy', 'P1'),
          ($1, 5, 'Third Party Liability Insurance', 'Contract requirement', 'Policy copy', 'P1'),
          ($1, 6, 'Workmen Compensation Policy', 'WC Act 1923', 'Policy copy', 'P1'),
          ($1, 7, 'Professional Indemnity Insurance (if applicable)', 'Contract requirement', 'Policy copy', 'P2')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sectionDResult.rows[0].id]);
      }

      // Section E - PESO COMPLIANCE items
      const sectionEResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'E'",
        [cat1Id]
      );
      if (sectionEResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'PESO License for petroleum storage >2500L', 'Petroleum Rules 2002', 'PESO License', 'P1'),
          ($1, 2, 'PESO License for explosives (if blasting)', 'Explosives Act 1884', 'License copy', 'P1'),
          ($1, 3, 'Magazine license for detonators/explosives', 'Explosives Rules 2008', 'License copy', 'P1'),
          ($1, 4, 'Qualified Shot-firer/Blaster appointed', 'Explosives Rules 2008', 'Competency certificate', 'P1'),
          ($1, 5, 'Explosive van license valid', 'Explosives Rules 2008', 'License copy', 'P1'),
          ($1, 6, 'Daily explosive consumption register', 'Explosives Rules 2008', 'Register', 'P1'),
          ($1, 7, 'PESO inspection compliance', 'PESO Guidelines', 'Inspection reports', 'P1')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sectionEResult.rows[0].id]);
      }

      // Section F - CPCB/SPCB COMPLIANCE items
      const sectionFResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'F'",
        [cat1Id]
      );
      if (sectionFResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'Consent to Establish (CTE) obtained', 'Air/Water Act', 'CTE copy', 'P1'),
          ($1, 2, 'Consent to Operate (CTO) obtained', 'Air/Water Act', 'CTO copy', 'P1'),
          ($1, 3, 'Annual Returns submitted to SPCB', 'SPCB Guidelines', 'Submission receipt', 'P1'),
          ($1, 4, 'Environmental Statement submitted', 'Environment Protection Act', 'Statement copy', 'P1'),
          ($1, 5, 'Hazardous Waste manifest maintained', 'HW Rules 2016', 'Manifest records', 'P1')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sectionFResult.rows[0].id]);
      }

      // Section G - MOTOR VEHICLE ACT items
      const sectionGResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'G'",
        [cat1Id]
      );
      if (sectionGResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'All vehicles registered with RTO', 'MV Act 1988', 'RC copies', 'P1'),
          ($1, 2, 'Commercial vehicles fitness certificate valid', 'MV Act 1988', 'Fitness certificate', 'P1'),
          ($1, 3, 'Vehicle insurance valid (comprehensive)', 'MV Act 1988', 'Insurance copies', 'P1'),
          ($1, 4, 'Drivers have valid driving license', 'MV Act 1988', 'DL copies', 'P1'),
          ($1, 5, 'Transport vehicle permit valid', 'MV Act 1988', 'Permit copies', 'P1'),
          ($1, 6, 'PUC certificates valid', 'MV Act 1988', 'PUC certificates', 'P1'),
          ($1, 7, 'Vehicle log books maintained', 'Best Practice', 'Log books', 'P2'),
          ($1, 8, 'Speed governors fitted (if required)', 'MV Rules', 'Physical verification', 'P1')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sectionGResult.rows[0].id]);
      }
    }
    logger.info('Audit Sections and Items seeded');

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

    // Seed sections and items for Category 02 - SHE Management System
    const cat2Result = await db.query("SELECT id FROM audit_categories WHERE code = '02'");
    if (cat2Result.rows.length > 0) {
      const cat2Id = cat2Result.rows[0].id;
      await db.query(`
        INSERT INTO audit_sections (category_id, code, name, display_order) VALUES
        ($1, 'A', 'SAFETY POLICY & ORGANIZATION', 1),
        ($1, 'B', 'SAFETY PLANNING & OBJECTIVES', 2),
        ($1, 'C', 'PERFORMANCE MEASUREMENT', 3)
        ON CONFLICT (category_id, code) DO NOTHING
      `, [cat2Id]);

      const sec2AResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'A'", [cat2Id]
      );
      if (sec2AResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'SHE Policy document signed by top management', 'ISO 45001:2018 Clause 5.2', 'Signed policy document', 'P1'),
          ($1, 2, 'SHE Policy displayed at prominent locations', 'ISO 45001:2018 Clause 5.2', 'Physical verification', 'P2'),
          ($1, 3, 'SHE Organization structure defined', 'ISO 45001:2018 Clause 5.3', 'Organization chart', 'P1'),
          ($1, 4, 'Safety Officer appointed as per statute', 'BOCW Rules - Rule 209', 'Appointment letter', 'P1'),
          ($1, 5, 'Safety Committee formed and functional', 'Section 38, BOCW Act', 'Committee records', 'P1'),
          ($1, 6, 'Safety Committee meetings conducted monthly', 'Rule 208, BOCW Rules', 'Meeting minutes', 'P1'),
          ($1, 7, 'Management review meetings conducted', 'ISO 45001:2018 Clause 9.3', 'MRM records', 'P2'),
          ($1, 8, 'Responsibilities and authorities documented', 'ISO 45001:2018 Clause 5.3', 'RACI matrix', 'P2')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sec2AResult.rows[0].id]);
      }
    }
    logger.info('Category 02 sections and items seeded');

    // Seed sections and items for Category 03 - HIRA
    const cat3Result = await db.query("SELECT id FROM audit_categories WHERE code = '03'");
    if (cat3Result.rows.length > 0) {
      const cat3Id = cat3Result.rows[0].id;
      await db.query(`
        INSERT INTO audit_sections (category_id, code, name, display_order) VALUES
        ($1, 'A', 'HAZARD IDENTIFICATION', 1),
        ($1, 'B', 'RISK ASSESSMENT METHODOLOGY', 2),
        ($1, 'C', 'CONTROL MEASURES', 3)
        ON CONFLICT (category_id, code) DO NOTHING
      `, [cat3Id]);

      const sec3AResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'A'", [cat3Id]
      );
      if (sec3AResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'HIRA register maintained for all activities', 'ISO 45001:2018 Clause 6.1', 'HIRA register', 'P1'),
          ($1, 2, 'HIRA conducted before start of new activity', 'ISO 45001:2018 Clause 6.1.2', 'HIRA records', 'P1'),
          ($1, 3, 'All hazards identified including routine & non-routine', 'ISO 45001:2018 Clause 6.1.2.1', 'Hazard list', 'P1'),
          ($1, 4, 'Risk rating methodology defined and followed', 'ISO 45001:2018 Clause 6.1.2.2', 'Risk matrix', 'P1'),
          ($1, 5, 'Controls determined using hierarchy of controls', 'ISO 45001:2018 Clause 8.1.2', 'Control measures', 'P1'),
          ($1, 6, 'Residual risk evaluated and documented', 'ISO 45001:2018 Clause 6.1.2.2', 'Risk register', 'P2'),
          ($1, 7, 'HIRA reviewed periodically or after incidents', 'ISO 45001:2018 Clause 6.1.2', 'Review records', 'P2'),
          ($1, 8, 'Workers involved in HIRA process', 'ISO 45001:2018 Clause 5.4', 'Participation records', 'P2')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sec3AResult.rows[0].id]);
      }
    }
    logger.info('Category 03 sections and items seeded');

    // Seed sections and items for Category 04 - Work Permits & LOTO
    const cat4Result = await db.query("SELECT id FROM audit_categories WHERE code = '04'");
    if (cat4Result.rows.length > 0) {
      const cat4Id = cat4Result.rows[0].id;
      await db.query(`
        INSERT INTO audit_sections (category_id, code, name, display_order) VALUES
        ($1, 'A', 'PERMIT TO WORK SYSTEM', 1),
        ($1, 'B', 'LOCKOUT TAGOUT (LOTO)', 2)
        ON CONFLICT (category_id, code) DO NOTHING
      `, [cat4Id]);

      const sec4AResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'A'", [cat4Id]
      );
      if (sec4AResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'PTW procedure established for hazardous works', 'MAHSR Safety Standards', 'PTW procedure', 'P1'),
          ($1, 2, 'High-risk activities identified requiring PTW', 'MAHSR Safety Standards', 'Activity list', 'P1'),
          ($1, 3, 'PTW forms designed with all necessary fields', 'Best Practice', 'PTW formats', 'P2'),
          ($1, 4, 'Authorized persons list for issuing PTW defined', 'MAHSR Safety Standards', 'Authorization list', 'P1'),
          ($1, 5, 'PTW validity period defined and adhered', 'MAHSR Safety Standards', 'PTW records', 'P1'),
          ($1, 6, 'PTW closure process followed', 'MAHSR Safety Standards', 'Closure records', 'P1'),
          ($1, 7, 'PTW register maintained', 'MAHSR Safety Standards', 'PTW register', 'P2'),
          ($1, 8, 'Workers trained on PTW system', 'MAHSR Safety Standards', 'Training records', 'P1')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sec4AResult.rows[0].id]);
      }

      const sec4BResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'B'", [cat4Id]
      );
      if (sec4BResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'LOTO procedure established', 'OSHA 29 CFR 1910.147', 'LOTO procedure', 'P1'),
          ($1, 2, 'Energy sources identified for all equipment', 'OSHA 29 CFR 1910.147', 'Energy isolation list', 'P1'),
          ($1, 3, 'Personal locks and tags provided', 'OSHA 29 CFR 1910.147', 'Physical verification', 'P1'),
          ($1, 4, 'LOTO application and removal process defined', 'OSHA 29 CFR 1910.147', 'Procedure document', 'P1'),
          ($1, 5, 'Group LOTO procedure established', 'OSHA 29 CFR 1910.147', 'Group LOTO procedure', 'P2'),
          ($1, 6, 'LOTO training provided to all affected workers', 'OSHA 29 CFR 1910.147', 'Training records', 'P1')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sec4BResult.rows[0].id]);
      }
    }
    logger.info('Category 04 sections and items seeded');

    // Seed sections and items for Category 05 - Scaffolding & Work at Height
    const cat5Result = await db.query("SELECT id FROM audit_categories WHERE code = '05'");
    if (cat5Result.rows.length > 0) {
      const cat5Id = cat5Result.rows[0].id;
      await db.query(`
        INSERT INTO audit_sections (category_id, code, name, display_order) VALUES
        ($1, 'A', 'SCAFFOLDING', 1),
        ($1, 'B', 'WORK AT HEIGHT', 2),
        ($1, 'C', 'FALL PROTECTION', 3)
        ON CONFLICT (category_id, code) DO NOTHING
      `, [cat5Id]);

      const sec5AResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'A'", [cat5Id]
      );
      if (sec5AResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'Scaffold erected by competent person', 'Rule 45, BOCW Rules', 'Competency certificate', 'P1'),
          ($1, 2, 'Scaffold design approved by engineer', 'Rule 46, BOCW Rules', 'Design approval', 'P1'),
          ($1, 3, 'Scaffold base on firm foundation', 'Rule 47, BOCW Rules', 'Physical verification', 'P1'),
          ($1, 4, 'Standard scaffolding components used', 'IS 2750:1989', 'Material records', 'P1'),
          ($1, 5, 'Toe boards and guardrails provided', 'Rule 48, BOCW Rules', 'Physical verification', 'P1'),
          ($1, 6, 'Scaffold inspection before each shift', 'Rule 49, BOCW Rules', 'Inspection records', 'P1'),
          ($1, 7, 'Scaffold tag system implemented', 'Best Practice', 'Tag verification', 'P1'),
          ($1, 8, 'Access ladder properly secured', 'Rule 50, BOCW Rules', 'Physical verification', 'P1'),
          ($1, 9, 'Scaffold free from excessive loading', 'Rule 51, BOCW Rules', 'Load calculation', 'P2'),
          ($1, 10, 'Scaffold maintained in good condition', 'Rule 52, BOCW Rules', 'Maintenance records', 'P2')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sec5AResult.rows[0].id]);
      }

      const sec5BResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'B'", [cat5Id]
      );
      if (sec5BResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'Work at height permit issued for works above 2m', 'MAHSR Safety Standards', 'Permit records', 'P1'),
          ($1, 2, 'Fall protection plan prepared', 'OSHA 1926.502', 'Fall protection plan', 'P1'),
          ($1, 3, 'Edge protection provided at all open edges', 'Rule 53, BOCW Rules', 'Physical verification', 'P1'),
          ($1, 4, 'Safety nets installed where required', 'Rule 54, BOCW Rules', 'Physical verification', 'P1'),
          ($1, 5, 'MEWP/Aerial work platform certified', 'IS 16368:2015', 'Certification', 'P1'),
          ($1, 6, 'Workers trained in work at height', 'MAHSR Safety Standards', 'Training records', 'P1')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sec5BResult.rows[0].id]);
      }
    }
    logger.info('Category 05 sections and items seeded');

    // Seed sections and items for Category 06 - Excavation
    const cat6Result = await db.query("SELECT id FROM audit_categories WHERE code = '06'");
    if (cat6Result.rows.length > 0) {
      const cat6Id = cat6Result.rows[0].id;
      await db.query(`
        INSERT INTO audit_sections (category_id, code, name, display_order) VALUES
        ($1, 'A', 'EXCAVATION PLANNING', 1),
        ($1, 'B', 'EXCAVATION EXECUTION', 2),
        ($1, 'C', 'SHORING & PROTECTION', 3)
        ON CONFLICT (category_id, code) DO NOTHING
      `, [cat6Id]);

      const sec6AResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'A'", [cat6Id]
      );
      if (sec6AResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'Underground utilities identified before excavation', 'Rule 55, BOCW Rules', 'Utility survey', 'P1'),
          ($1, 2, 'Excavation permit obtained', 'MAHSR Safety Standards', 'Permit copy', 'P1'),
          ($1, 3, 'Soil classification done', 'OSHA 1926.652', 'Soil report', 'P1'),
          ($1, 4, 'Excavation plan approved', 'Rule 56, BOCW Rules', 'Approved plan', 'P1'),
          ($1, 5, 'Competent person assigned for supervision', 'Rule 57, BOCW Rules', 'Assignment record', 'P1'),
          ($1, 6, 'Emergency rescue plan in place', 'MAHSR Safety Standards', 'Rescue plan', 'P1'),
          ($1, 7, 'Barricading done around excavation', 'Rule 58, BOCW Rules', 'Physical verification', 'P1'),
          ($1, 8, 'Warning signs and lights provided', 'Rule 59, BOCW Rules', 'Physical verification', 'P1')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sec6AResult.rows[0].id]);
      }
    }
    logger.info('Category 06 sections and items seeded');

    // Seed sections and items for Category 08 - Lifting & Cranes
    const cat8Result = await db.query("SELECT id FROM audit_categories WHERE code = '08'");
    if (cat8Result.rows.length > 0) {
      const cat8Id = cat8Result.rows[0].id;
      await db.query(`
        INSERT INTO audit_sections (category_id, code, name, display_order) VALUES
        ($1, 'A', 'CRANE OPERATION', 1),
        ($1, 'B', 'LIFTING ACCESSORIES', 2),
        ($1, 'C', 'LIFT PLANNING', 3)
        ON CONFLICT (category_id, code) DO NOTHING
      `, [cat8Id]);

      const sec8AResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'A'", [cat8Id]
      );
      if (sec8AResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'Crane third party certified', 'Rule 60, BOCW Rules', 'TPI certificate', 'P1'),
          ($1, 2, 'Crane operator licensed', 'Rule 61, BOCW Rules', 'Operator license', 'P1'),
          ($1, 3, 'Crane load chart available and legible', 'IS 4573:1982', 'Physical verification', 'P1'),
          ($1, 4, 'Daily inspection by operator', 'MAHSR Safety Standards', 'Checklist records', 'P1'),
          ($1, 5, 'Outriggers fully extended during operation', 'IS 4573:1982', 'Physical verification', 'P1'),
          ($1, 6, 'Anti-collision devices functional', 'MAHSR Safety Standards', 'Inspection records', 'P1'),
          ($1, 7, 'Load moment indicator (LMI) working', 'IS 4573:1982', 'Functional test', 'P1'),
          ($1, 8, 'Trained signalman/rigger available', 'Rule 62, BOCW Rules', 'Training records', 'P1'),
          ($1, 9, 'Crane logbook maintained', 'MAHSR Safety Standards', 'Logbook', 'P2'),
          ($1, 10, 'Ground conditions checked before setup', 'IS 4573:1982', 'Ground survey', 'P1')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sec8AResult.rows[0].id]);
      }
    }
    logger.info('Category 08 sections and items seeded');

    // Seed sections and items for Category 09 - Electrical Safety
    const cat9Result = await db.query("SELECT id FROM audit_categories WHERE code = '09'");
    if (cat9Result.rows.length > 0) {
      const cat9Id = cat9Result.rows[0].id;
      await db.query(`
        INSERT INTO audit_sections (category_id, code, name, display_order) VALUES
        ($1, 'A', 'ELECTRICAL INSTALLATIONS', 1),
        ($1, 'B', 'ELECTRICAL SAFETY PRACTICES', 2)
        ON CONFLICT (category_id, code) DO NOTHING
      `, [cat9Id]);

      const sec9AResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'A'", [cat9Id]
      );
      if (sec9AResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'Electrical installation as per IE Rules', 'IE Rules 2003', 'Installation records', 'P1'),
          ($1, 2, 'Licensed electrical contractor engaged', 'IE Rules 2003', 'Contractor license', 'P1'),
          ($1, 3, 'Earthing provided and tested', 'IS 3043:2018', 'Test reports', 'P1'),
          ($1, 4, 'ELCB/RCCB installed in distribution boards', 'IE Rules 2003', 'Physical verification', 'P1'),
          ($1, 5, 'Circuit breakers rated correctly', 'IS 13947', 'Rating verification', 'P1'),
          ($1, 6, 'Temporary wiring standards followed', 'Rule 63, BOCW Rules', 'Physical verification', 'P1'),
          ($1, 7, 'Double insulated tools used', 'IS 6982:1985', 'Tool inspection', 'P1'),
          ($1, 8, 'Electrical panels locked and labeled', 'IE Rules 2003', 'Physical verification', 'P1')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sec9AResult.rows[0].id]);
      }
    }
    logger.info('Category 09 sections and items seeded');

    // Seed sections and items for Category 10 - Fire & Emergency
    const cat10Result = await db.query("SELECT id FROM audit_categories WHERE code = '10'");
    if (cat10Result.rows.length > 0) {
      const cat10Id = cat10Result.rows[0].id;
      await db.query(`
        INSERT INTO audit_sections (category_id, code, name, display_order) VALUES
        ($1, 'A', 'FIRE PREVENTION', 1),
        ($1, 'B', 'FIRE FIGHTING', 2),
        ($1, 'C', 'EMERGENCY PREPAREDNESS', 3)
        ON CONFLICT (category_id, code) DO NOTHING
      `, [cat10Id]);

      const sec10AResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'A'", [cat10Id]
      );
      if (sec10AResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'Fire risk assessment conducted', 'NBC 2016', 'Risk assessment', 'P1'),
          ($1, 2, 'Hot work permit system implemented', 'MAHSR Safety Standards', 'Permit records', 'P1'),
          ($1, 3, 'Flammable material storage as per norms', 'PESO Rules', 'Storage records', 'P1'),
          ($1, 4, 'No smoking policy enforced', 'MAHSR Safety Standards', 'Signage verification', 'P2'),
          ($1, 5, 'Housekeeping maintained to prevent fire', 'Best Practice', 'Physical verification', 'P2'),
          ($1, 6, 'Electrical fire prevention measures in place', 'IE Rules 2003', 'Inspection records', 'P1')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sec10AResult.rows[0].id]);
      }

      const sec10BResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'B'", [cat10Id]
      );
      if (sec10BResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'Fire extinguishers provided adequately', 'NBC 2016', 'Physical verification', 'P1'),
          ($1, 2, 'Fire extinguishers inspected monthly', 'IS 2190:2019', 'Inspection records', 'P1'),
          ($1, 3, 'Fire extinguishers refilled annually', 'IS 2190:2019', 'Refill records', 'P1'),
          ($1, 4, 'Fire hydrant system functional', 'NBC 2016', 'Test records', 'P1'),
          ($1, 5, 'Fire alarm system installed and tested', 'NBC 2016', 'Test records', 'P1'),
          ($1, 6, 'Fire trained personnel available 24x7', 'MAHSR Safety Standards', 'Training records', 'P1')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sec10BResult.rows[0].id]);
      }

      const sec10CResult = await db.query(
        "SELECT id FROM audit_sections WHERE category_id = $1 AND code = 'C'", [cat10Id]
      );
      if (sec10CResult.rows.length > 0) {
        await db.query(`
          INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority) VALUES
          ($1, 1, 'Emergency response plan documented', 'ISO 45001:2018 Clause 8.2', 'ERP document', 'P1'),
          ($1, 2, 'Emergency evacuation routes marked', 'NBC 2016', 'Physical verification', 'P1'),
          ($1, 3, 'Assembly points identified', 'Best Practice', 'Signage verification', 'P1'),
          ($1, 4, 'Emergency contact numbers displayed', 'MAHSR Safety Standards', 'Physical verification', 'P2'),
          ($1, 5, 'Mock drills conducted quarterly', 'ISO 45001:2018 Clause 8.2', 'Drill records', 'P1'),
          ($1, 6, 'First responders trained in fire fighting', 'MAHSR Safety Standards', 'Training records', 'P1'),
          ($1, 7, 'Tie-up with hospital/ambulance', 'Rule 232, BOCW Rules', 'MOU/Agreement', 'P1')
          ON CONFLICT (section_id, sr_no) DO NOTHING
        `, [sec10CResult.rows[0].id]);
      }
    }
    logger.info('Category 10 sections and items seeded');

    // Seed Sample Audits
    logger.info('Seeding sample audits...');

    // Get user and package IDs for creating audits
    const auditorResult = await db.query("SELECT id FROM users WHERE email = 'auditor1@mahsr.com'");
    const reviewerResult = await db.query("SELECT id FROM users WHERE email = 'manager.c2@mahsr.com'");
    const package2Result = await db.query("SELECT id FROM packages WHERE code = 'C2'");
    const package3Result = await db.query("SELECT id FROM packages WHERE code = 'C3'");

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
