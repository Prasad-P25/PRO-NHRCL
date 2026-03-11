// Utility function tests

describe('Compliance Calculation', () => {
  // Test compliance percentage formula: (Compliant / (Total - NA)) * 100
  const calculateCompliance = (
    compliant: number,
    nonCompliant: number,
    na: number
  ): number | null => {
    const total = compliant + nonCompliant;
    if (total === 0) return null;
    return Math.round((compliant / total) * 100 * 10) / 10;
  };

  test('should calculate 100% compliance when all items are compliant', () => {
    expect(calculateCompliance(10, 0, 0)).toBe(100);
  });

  test('should calculate 0% compliance when no items are compliant', () => {
    expect(calculateCompliance(0, 10, 0)).toBe(0);
  });

  test('should calculate 50% compliance correctly', () => {
    expect(calculateCompliance(5, 5, 0)).toBe(50);
  });

  test('should ignore NA items in calculation', () => {
    // 8 compliant, 2 non-compliant, 10 NA = 80%
    expect(calculateCompliance(8, 2, 10)).toBe(80);
  });

  test('should return null when no items to calculate', () => {
    expect(calculateCompliance(0, 0, 5)).toBeNull();
  });
});

describe('KPI Formula Calculations', () => {
  // LTIFR = (Lost Time Injuries × 1,000,000) / Man-hours
  const calculateLTIFR = (lostTimeInjuries: number, manHours: number): number | null => {
    if (manHours === 0) return null;
    return Math.round((lostTimeInjuries * 1000000) / manHours * 100) / 100;
  };

  test('should calculate LTIFR correctly', () => {
    // 2 LTIs in 1,000,000 man-hours = 2.0
    expect(calculateLTIFR(2, 1000000)).toBe(2);
  });

  test('should calculate LTIFR with decimals', () => {
    // 1 LTI in 500,000 man-hours = 2.0
    expect(calculateLTIFR(1, 500000)).toBe(2);
  });

  test('should return null for zero man-hours', () => {
    expect(calculateLTIFR(1, 0)).toBeNull();
  });

  test('should return 0 for zero injuries', () => {
    expect(calculateLTIFR(0, 1000000)).toBe(0);
  });
});

describe('CAPA Number Generation', () => {
  const generateCAPANumber = (year: number, count: number): string => {
    return `CAPA-${year}-${String(count).padStart(4, '0')}`;
  };

  test('should generate CAPA number with padded count', () => {
    expect(generateCAPANumber(2024, 1)).toBe('CAPA-2024-0001');
    expect(generateCAPANumber(2024, 10)).toBe('CAPA-2024-0010');
    expect(generateCAPANumber(2024, 100)).toBe('CAPA-2024-0100');
    expect(generateCAPANumber(2024, 1000)).toBe('CAPA-2024-1000');
  });
});

describe('Audit Number Generation', () => {
  const generateAuditNumber = (
    packageCode: string,
    year: number,
    count: number
  ): string => {
    return `AUD-${packageCode}-${year}-${String(count).padStart(3, '0')}`;
  };

  test('should generate audit number correctly', () => {
    expect(generateAuditNumber('C1', 2024, 1)).toBe('AUD-C1-2024-001');
    expect(generateAuditNumber('C2', 2024, 15)).toBe('AUD-C2-2024-015');
  });
});

describe('Risk Rating Classification', () => {
  type RiskRating = 'Low' | 'Medium' | 'High' | 'Critical';

  const classifyRisk = (observation: string, hasCapa: boolean): RiskRating => {
    const lowerObs = observation.toLowerCase();
    if (
      lowerObs.includes('fatality') ||
      lowerObs.includes('life threatening') ||
      lowerObs.includes('immediate danger')
    ) {
      return 'Critical';
    }
    if (
      lowerObs.includes('serious') ||
      lowerObs.includes('major') ||
      hasCapa
    ) {
      return 'High';
    }
    if (lowerObs.includes('minor')) {
      return 'Low';
    }
    return 'Medium';
  };

  test('should classify fatality-related observations as Critical', () => {
    expect(classifyRisk('Risk of fatality identified', false)).toBe('Critical');
  });

  test('should classify serious observations as High', () => {
    expect(classifyRisk('Serious safety violation', false)).toBe('High');
  });

  test('should classify observations with CAPA as High', () => {
    expect(classifyRisk('General observation', true)).toBe('High');
  });

  test('should classify minor observations as Low', () => {
    expect(classifyRisk('Minor documentation issue', false)).toBe('Low');
  });

  test('should default to Medium for other observations', () => {
    expect(classifyRisk('Standard observation', false)).toBe('Medium');
  });
});

describe('Date Utilities', () => {
  const isOverdue = (targetDate: Date): boolean => {
    return targetDate < new Date();
  };

  const getDaysOverdue = (targetDate: Date): number => {
    const now = new Date();
    const diff = now.getTime() - targetDate.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  test('should identify overdue dates', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    expect(isOverdue(pastDate)).toBe(true);
  });

  test('should identify non-overdue dates', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    expect(isOverdue(futureDate)).toBe(false);
  });

  test('should calculate days overdue correctly', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    expect(getDaysOverdue(pastDate)).toBe(5);
  });
});
