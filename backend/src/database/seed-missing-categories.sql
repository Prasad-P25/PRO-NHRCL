-- Seed missing audit category sections and items
-- BUG-008 Fix: Add checklist items to empty categories

-- Category 7: Tunneling Safety
INSERT INTO audit_sections (category_id, code, name, display_order) VALUES (7, '07.1', 'Tunnel Entry & Ventilation', 1);

-- Category 11: PPE & Welfare
INSERT INTO audit_sections (category_id, code, name, display_order) VALUES (11, '11.1', 'Personal Protective Equipment', 1);
INSERT INTO audit_sections (category_id, code, name, display_order) VALUES (11, '11.2', 'Welfare Facilities', 2);

-- Category 12: Training & Competency
INSERT INTO audit_sections (category_id, code, name, display_order) VALUES (12, '12.1', 'Training Records', 1);

-- Category 13: Working Near IR Track
INSERT INTO audit_sections (category_id, code, name, display_order) VALUES (13, '13.1', 'Track Safety', 1);

-- Category 14: Formwork & Temp Structures
INSERT INTO audit_sections (category_id, code, name, display_order) VALUES (14, '14.1', 'Formwork Safety', 1);

-- Category 15: Bridge & Viaduct Works
INSERT INTO audit_sections (category_id, code, name, display_order) VALUES (15, '15.1', 'Bridge Construction Safety', 1);

-- Category 16: Plant & Machinery
INSERT INTO audit_sections (category_id, code, name, display_order) VALUES (16, '16.1', 'Equipment Safety', 1);

-- Category 17: Material Handling
INSERT INTO audit_sections (category_id, code, name, display_order) VALUES (17, '17.1', 'Storage & Handling', 1);

-- Category 18: Incident Management
INSERT INTO audit_sections (category_id, code, name, display_order) VALUES (18, '18.1', 'Incident Reporting', 1);

-- Now add items for each section

-- 07.1 Tunnel Entry & Ventilation
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 1, 'Tunnel ventilation system operational and adequate', 'P1', true FROM audit_sections WHERE code = '07.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 2, 'Gas monitoring equipment available and calibrated', 'P1', true FROM audit_sections WHERE code = '07.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 3, 'Emergency refuge chambers installed and accessible', 'P1', true FROM audit_sections WHERE code = '07.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 4, 'Tunnel lighting adequate for safe operations', 'P2', true FROM audit_sections WHERE code = '07.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 5, 'Communication systems functional inside tunnel', 'P1', true FROM audit_sections WHERE code = '07.1';

-- 11.1 Personal Protective Equipment
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 1, 'Workers wearing appropriate PPE for task', 'P1', true FROM audit_sections WHERE code = '11.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 2, 'PPE in good condition and properly maintained', 'P1', true FROM audit_sections WHERE code = '11.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 3, 'Safety helmets with chin straps worn correctly', 'P1', true FROM audit_sections WHERE code = '11.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 4, 'High visibility vests worn in required areas', 'P2', true FROM audit_sections WHERE code = '11.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 5, 'Safety footwear worn by all workers', 'P1', true FROM audit_sections WHERE code = '11.1';

-- 11.2 Welfare Facilities
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 1, 'Clean drinking water available at worksite', 'P1', true FROM audit_sections WHERE code = '11.2';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 2, 'Toilet facilities adequate and clean', 'P1', true FROM audit_sections WHERE code = '11.2';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 3, 'Rest area/shelter provided for workers', 'P2', true FROM audit_sections WHERE code = '11.2';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 4, 'First aid facilities available and stocked', 'P1', true FROM audit_sections WHERE code = '11.2';

-- 12.1 Training Records
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 1, 'All workers completed safety induction', 'P1', true FROM audit_sections WHERE code = '12.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 2, 'Job-specific training records maintained', 'P1', true FROM audit_sections WHERE code = '12.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 3, 'Toolbox talks conducted and documented', 'P1', true FROM audit_sections WHERE code = '12.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 4, 'Operator competency certificates valid', 'P1', true FROM audit_sections WHERE code = '12.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 5, 'Refresher training conducted as required', 'P2', true FROM audit_sections WHERE code = '12.1';

-- 13.1 Track Safety
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 1, 'OHE power block obtained before work', 'P1', true FROM audit_sections WHERE code = '13.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 2, 'Lookout men posted at required locations', 'P1', true FROM audit_sections WHERE code = '13.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 3, 'Warning signals and boards displayed', 'P1', true FROM audit_sections WHERE code = '13.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 4, 'Safe distance from live OHE maintained', 'P1', true FROM audit_sections WHERE code = '13.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 5, 'Railway safety officer approval obtained', 'P1', true FROM audit_sections WHERE code = '13.1';

-- 14.1 Formwork Safety
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 1, 'Formwork design approved by competent engineer', 'P1', true FROM audit_sections WHERE code = '14.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 2, 'Props and supports adequately braced', 'P1', true FROM audit_sections WHERE code = '14.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 3, 'Formwork inspected before concrete pour', 'P1', true FROM audit_sections WHERE code = '14.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 4, 'De-shuttering procedure followed correctly', 'P1', true FROM audit_sections WHERE code = '14.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 5, 'Load capacity of formwork not exceeded', 'P1', true FROM audit_sections WHERE code = '14.1';

-- 15.1 Bridge Construction Safety
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 1, 'Launching girder safety systems operational', 'P1', true FROM audit_sections WHERE code = '15.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 2, 'Pier work platforms with guardrails', 'P1', true FROM audit_sections WHERE code = '15.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 3, 'Segment lifting procedures followed', 'P1', true FROM audit_sections WHERE code = '15.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 4, 'Wind speed monitoring for lifting ops', 'P1', true FROM audit_sections WHERE code = '15.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 5, 'Fall protection for viaduct edge work', 'P1', true FROM audit_sections WHERE code = '15.1';

-- 16.1 Equipment Safety
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 1, 'All machinery has valid fitness certificate', 'P1', true FROM audit_sections WHERE code = '16.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 2, 'Daily pre-use inspection conducted', 'P1', true FROM audit_sections WHERE code = '16.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 3, 'Safety guards and devices functional', 'P1', true FROM audit_sections WHERE code = '16.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 4, 'Reverse alarm and beacons working', 'P1', true FROM audit_sections WHERE code = '16.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 5, 'Operators have valid license/competency', 'P1', true FROM audit_sections WHERE code = '16.1';

-- 17.1 Storage & Handling
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 1, 'Materials stacked safely and stable', 'P1', true FROM audit_sections WHERE code = '17.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 2, 'Hazardous materials stored as per MSDS', 'P1', true FROM audit_sections WHERE code = '17.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 3, 'Manual handling training provided', 'P2', true FROM audit_sections WHERE code = '17.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 4, 'Mechanical aids used for heavy loads', 'P2', true FROM audit_sections WHERE code = '17.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 5, 'Storage area access routes clear', 'P2', true FROM audit_sections WHERE code = '17.1';

-- 18.1 Incident Reporting
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 1, 'Incident reporting procedure displayed', 'P1', true FROM audit_sections WHERE code = '18.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 2, 'Near miss reporting system in place', 'P1', true FROM audit_sections WHERE code = '18.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 3, 'Incident investigation conducted timely', 'P1', true FROM audit_sections WHERE code = '18.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 4, 'Corrective actions implemented and tracked', 'P1', true FROM audit_sections WHERE code = '18.1';
INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active)
SELECT id, 5, 'Lessons learned shared with workforce', 'P2', true FROM audit_sections WHERE code = '18.1';
