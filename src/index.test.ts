import {describe, expect, it} from 'vitest';
import {generateSign, listHolidays, validateSignConfig} from './index.js';

describe('package entry point', () => {
  it('exposes validateSignConfig, listHolidays, and generateSign', () => {
    expect(typeof validateSignConfig).toBe('function');
    expect(typeof listHolidays).toBe('function');
    expect(typeof generateSign).toBe('function');
  });

  it('lists every bundled holiday', () => {
    expect(listHolidays()).toContain('christmas');
    expect(listHolidays().length).toBeGreaterThanOrEqual(8);
  });
});
