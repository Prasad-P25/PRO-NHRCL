// Input validation tests

describe('Email Validation', () => {
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  test('should validate correct email formats', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user.name@example.co.uk')).toBe(true);
    expect(isValidEmail('user+tag@example.org')).toBe(true);
  });

  test('should reject invalid email formats', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('missing@domain')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('spaces in@email.com')).toBe(false);
  });
});

describe('Password Validation', () => {
  const isValidPassword = (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return { valid: errors.length === 0, errors };
  };

  test('should accept valid passwords', () => {
    const result = isValidPassword('SecurePass123');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should reject short passwords', () => {
    const result = isValidPassword('Short1');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters');
  });

  test('should reject passwords without uppercase', () => {
    const result = isValidPassword('lowercase123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  test('should reject passwords without numbers', () => {
    const result = isValidPassword('NoNumbersHere');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one number');
  });
});

describe('Audit Type Validation', () => {
  const validAuditTypes = ['Full', 'Partial', 'Focused'] as const;
  type AuditType = typeof validAuditTypes[number];

  const isValidAuditType = (type: string): type is AuditType => {
    return validAuditTypes.includes(type as AuditType);
  };

  test('should accept valid audit types', () => {
    expect(isValidAuditType('Full')).toBe(true);
    expect(isValidAuditType('Partial')).toBe(true);
    expect(isValidAuditType('Focused')).toBe(true);
  });

  test('should reject invalid audit types', () => {
    expect(isValidAuditType('Invalid')).toBe(false);
    expect(isValidAuditType('full')).toBe(false); // Case-sensitive
    expect(isValidAuditType('')).toBe(false);
  });
});

describe('Response Status Validation', () => {
  const validStatuses = ['C', 'NC', 'NA', 'NR'] as const;
  type ResponseStatus = typeof validStatuses[number];

  const isValidStatus = (status: string): status is ResponseStatus => {
    return validStatuses.includes(status as ResponseStatus);
  };

  test('should accept valid response statuses', () => {
    expect(isValidStatus('C')).toBe(true);
    expect(isValidStatus('NC')).toBe(true);
    expect(isValidStatus('NA')).toBe(true);
    expect(isValidStatus('NR')).toBe(true);
  });

  test('should reject invalid response statuses', () => {
    expect(isValidStatus('Compliant')).toBe(false);
    expect(isValidStatus('c')).toBe(false); // Case-sensitive
    expect(isValidStatus('')).toBe(false);
  });
});

describe('Package Code Validation', () => {
  const isValidPackageCode = (code: string): boolean => {
    // Package codes should be alphanumeric, 1-10 characters
    const codeRegex = /^[A-Za-z0-9]{1,10}$/;
    return codeRegex.test(code);
  };

  test('should accept valid package codes', () => {
    expect(isValidPackageCode('C1')).toBe(true);
    expect(isValidPackageCode('C2')).toBe(true);
    expect(isValidPackageCode('PKG001')).toBe(true);
  });

  test('should reject invalid package codes', () => {
    expect(isValidPackageCode('C-1')).toBe(false); // Contains hyphen
    expect(isValidPackageCode('C 1')).toBe(false); // Contains space
    expect(isValidPackageCode('')).toBe(false);
    expect(isValidPackageCode('VERYLONGCODE12345')).toBe(false); // Too long
  });
});

describe('Date Range Validation', () => {
  const isValidDateRange = (startDate: Date, endDate: Date): boolean => {
    return startDate <= endDate;
  };

  test('should accept valid date ranges', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-12-31');
    expect(isValidDateRange(start, end)).toBe(true);
  });

  test('should accept same start and end date', () => {
    const date = new Date('2024-06-15');
    expect(isValidDateRange(date, date)).toBe(true);
  });

  test('should reject invalid date ranges', () => {
    const start = new Date('2024-12-31');
    const end = new Date('2024-01-01');
    expect(isValidDateRange(start, end)).toBe(false);
  });
});

describe('Pagination Validation', () => {
  const validatePagination = (
    page: number,
    pageSize: number
  ): { valid: boolean; page: number; pageSize: number } => {
    const validPage = Math.max(1, Math.floor(page) || 1);
    const validPageSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 20));
    return {
      valid: page > 0 && pageSize > 0 && pageSize <= 100,
      page: validPage,
      pageSize: validPageSize,
    };
  };

  test('should accept valid pagination parameters', () => {
    const result = validatePagination(1, 20);
    expect(result.valid).toBe(true);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  test('should cap page size at 100', () => {
    const result = validatePagination(1, 500);
    expect(result.pageSize).toBe(100);
  });

  test('should set minimum page to 1', () => {
    const result = validatePagination(-5, 20);
    expect(result.page).toBe(1);
  });

  test('should handle invalid values', () => {
    const result = validatePagination(NaN, NaN);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });
});
