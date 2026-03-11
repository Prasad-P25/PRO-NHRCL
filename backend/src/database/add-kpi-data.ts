import { db } from './connection';

async function addMoreKPIData() {
  console.log('Adding more KPI data...');

  const packages = await db.query('SELECT id FROM packages');
  const indicators = await db.query('SELECT id, name, type FROM kpi_indicators');

  console.log('Found', packages.rows.length, 'packages and', indicators.rows.length, 'indicators');

  const currentDate = new Date();

  for (const pkg of packages.rows) {
    for (const indicator of indicators.rows) {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      let targetValue: number | null = null;
      let actualValue: number | null = null;
      const manHours = 450000 + Math.floor(Math.random() * 150000);
      const incidents = Math.floor(Math.random() * 2);

      if (indicator.name.includes('%') || indicator.name.includes('Rate')) {
        targetValue = 95;
        actualValue = 85 + Math.floor(Math.random() * 15);
      } else if (indicator.name.includes('LTIFR')) {
        targetValue = 0.5;
        actualValue = Math.random() * 0.4;
      } else if (indicator.name.includes('TRIFR')) {
        targetValue = 1.0;
        actualValue = Math.random() * 0.8;
      } else if (indicator.name.includes('Man-hours')) {
        actualValue = manHours;
      } else if (indicator.name.includes('Days Without')) {
        actualValue = 45 + Math.floor(Math.random() * 100);
      } else if (indicator.name.includes('Fatality')) {
        actualValue = 0;
        targetValue = 0;
      } else if (indicator.name.includes('Severity')) {
        actualValue = Math.random() * 5;
      } else {
        actualValue = 20 + Math.floor(Math.random() * 30);
      }

      try {
        await db.query(`
          INSERT INTO kpi_entries (package_id, indicator_id, period_month, period_year,
            target_value, actual_value, man_hours_worked, incidents_count, entered_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
          ON CONFLICT (package_id, indicator_id, period_month, period_year)
          DO UPDATE SET actual_value = $6, target_value = $5, man_hours_worked = $7
        `, [pkg.id, indicator.id, month, year, targetValue, actualValue, manHours, incidents]);
      } catch (e: any) {
        console.log('Error for indicator', indicator.name, ':', e.message);
      }
    }
  }

  console.log('KPI data added successfully!');
  process.exit(0);
}

addMoreKPIData().catch(e => { console.error(e); process.exit(1); });
