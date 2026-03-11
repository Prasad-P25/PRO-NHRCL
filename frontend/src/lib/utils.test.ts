import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility function', () => {
  it('should merge class names', () => {
    const result = cn('class1', 'class2');
    expect(result).toBe('class1 class2');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    const result = cn('base', isActive && 'active');
    expect(result).toBe('base active');
  });

  it('should filter out falsy values', () => {
    const result = cn('base', false && 'hidden', null, undefined, 'visible');
    expect(result).toBe('base visible');
  });

  it('should merge tailwind classes correctly', () => {
    // tailwind-merge should handle conflicting utilities
    const result = cn('px-2', 'px-4');
    expect(result).toBe('px-4');
  });

  it('should handle empty input', () => {
    const result = cn();
    expect(result).toBe('');
  });
});
