import { describe, it, expect } from 'vitest';

// Test utility functions that would be in export.ts

describe('Export Utilities', () => {
  describe('formatDate', () => {
    const formatDate = (date: Date | string): string => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };

    it('should format date correctly', () => {
      const date = new Date('2024-03-15');
      expect(formatDate(date)).toMatch(/15.*Mar.*2024/);
    });

    it('should handle string dates', () => {
      const result = formatDate('2024-06-20');
      expect(result).toMatch(/20.*Jun.*2024/);
    });
  });

  describe('formatPercentage', () => {
    const formatPercentage = (value: number, decimals = 1): string => {
      return `${value.toFixed(decimals)}%`;
    };

    it('should format percentage with default decimals', () => {
      expect(formatPercentage(85.5)).toBe('85.5%');
    });

    it('should format percentage with custom decimals', () => {
      expect(formatPercentage(85.567, 2)).toBe('85.57%');
    });

    it('should handle whole numbers', () => {
      expect(formatPercentage(100)).toBe('100.0%');
    });
  });

  describe('sanitizeFilename', () => {
    const sanitizeFilename = (name: string): string => {
      return name
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 200);
    };

    it('should replace invalid characters', () => {
      expect(sanitizeFilename('file:name/test')).toBe('file_name_test');
    });

    it('should replace spaces with underscores', () => {
      expect(sanitizeFilename('my file name')).toBe('my_file_name');
    });

    it('should truncate long filenames', () => {
      const longName = 'a'.repeat(250);
      expect(sanitizeFilename(longName).length).toBe(200);
    });
  });
});

describe('Compliance Status Helpers', () => {
  describe('getComplianceColor', () => {
    const getComplianceColor = (percentage: number): string => {
      if (percentage >= 80) return 'green';
      if (percentage >= 60) return 'yellow';
      return 'red';
    };

    it('should return green for high compliance', () => {
      expect(getComplianceColor(85)).toBe('green');
      expect(getComplianceColor(100)).toBe('green');
      expect(getComplianceColor(80)).toBe('green');
    });

    it('should return yellow for medium compliance', () => {
      expect(getComplianceColor(75)).toBe('yellow');
      expect(getComplianceColor(60)).toBe('yellow');
    });

    it('should return red for low compliance', () => {
      expect(getComplianceColor(50)).toBe('red');
      expect(getComplianceColor(0)).toBe('red');
    });
  });

  describe('getStatusBadgeVariant', () => {
    type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';
    type AuditStatus = 'Draft' | 'In Progress' | 'Pending Review' | 'Approved' | 'Rejected';

    const getStatusBadgeVariant = (status: AuditStatus): BadgeVariant => {
      switch (status) {
        case 'Approved':
          return 'default';
        case 'Rejected':
          return 'destructive';
        case 'Pending Review':
          return 'secondary';
        default:
          return 'outline';
      }
    };

    it('should return correct variant for each status', () => {
      expect(getStatusBadgeVariant('Approved')).toBe('default');
      expect(getStatusBadgeVariant('Rejected')).toBe('destructive');
      expect(getStatusBadgeVariant('Pending Review')).toBe('secondary');
      expect(getStatusBadgeVariant('Draft')).toBe('outline');
      expect(getStatusBadgeVariant('In Progress')).toBe('outline');
    });
  });
});

describe('KPI Calculations', () => {
  describe('calculateKPIScore', () => {
    const calculateKPIScore = (
      actual: number,
      target: number,
      invertColors: boolean
    ): number => {
      if (target === 0) return 0;

      if (invertColors) {
        // For lower-is-better metrics
        if (actual === 0) return 100;
        if (actual <= target) return 100;
        return Math.max(0, Math.round((target / actual) * 100));
      }

      // For higher-is-better metrics
      return Math.min(100, Math.round((actual / target) * 100));
    };

    it('should calculate score for higher-is-better metrics', () => {
      expect(calculateKPIScore(80, 100, false)).toBe(80);
      expect(calculateKPIScore(100, 100, false)).toBe(100);
      expect(calculateKPIScore(120, 100, false)).toBe(100); // Capped at 100
    });

    it('should calculate score for lower-is-better metrics', () => {
      expect(calculateKPIScore(0, 2, true)).toBe(100); // Zero actual is perfect
      expect(calculateKPIScore(1, 2, true)).toBe(100); // Below target is 100
      expect(calculateKPIScore(4, 2, true)).toBe(50); // Double target is 50%
    });

    it('should handle zero target', () => {
      expect(calculateKPIScore(50, 0, false)).toBe(0);
    });
  });
});

describe('Array Utilities', () => {
  describe('groupBy', () => {
    const groupBy = <T, K extends string | number>(
      array: T[],
      keyFn: (item: T) => K
    ): Record<K, T[]> => {
      return array.reduce((acc, item) => {
        const key = keyFn(item);
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(item);
        return acc;
      }, {} as Record<K, T[]>);
    };

    it('should group items by key', () => {
      const items = [
        { type: 'A', value: 1 },
        { type: 'B', value: 2 },
        { type: 'A', value: 3 },
      ];

      const grouped = groupBy(items, (item) => item.type);

      expect(grouped['A']).toHaveLength(2);
      expect(grouped['B']).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const grouped = groupBy([], (item: { type: string }) => item.type);
      expect(Object.keys(grouped)).toHaveLength(0);
    });
  });

  describe('sortBy', () => {
    const sortBy = <T>(array: T[], keyFn: (item: T) => number | string): T[] => {
      return [...array].sort((a, b) => {
        const aKey = keyFn(a);
        const bKey = keyFn(b);
        if (aKey < bKey) return -1;
        if (aKey > bKey) return 1;
        return 0;
      });
    };

    it('should sort by numeric key', () => {
      const items = [{ value: 3 }, { value: 1 }, { value: 2 }];
      const sorted = sortBy(items, (item) => item.value);
      expect(sorted.map((i) => i.value)).toEqual([1, 2, 3]);
    });

    it('should sort by string key', () => {
      const items = [{ name: 'C' }, { name: 'A' }, { name: 'B' }];
      const sorted = sortBy(items, (item) => item.name);
      expect(sorted.map((i) => i.name)).toEqual(['A', 'B', 'C']);
    });

    it('should not mutate original array', () => {
      const items = [{ value: 3 }, { value: 1 }];
      const sorted = sortBy(items, (item) => item.value);
      expect(items[0].value).toBe(3); // Original unchanged
      expect(sorted[0].value).toBe(1);
    });
  });
});
