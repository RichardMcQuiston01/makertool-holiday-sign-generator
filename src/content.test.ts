import {describe, expect, it} from 'vitest';
import {
  HOLIDAY_CATALOG,
  getHolidayContent,
  listHolidays,
  resolveImage,
  resolveSaying,
} from './content.js';

describe('HOLIDAY_CATALOG', () => {
  it('gives every holiday at least one saying and one image', () => {
    for (const holiday of listHolidays()) {
      const content = getHolidayContent(holiday);
      expect(content.sayings.length).toBeGreaterThan(0);
      expect(content.images.length).toBeGreaterThan(0);
      expect(content.label.length).toBeGreaterThan(0);
    }
  });

  it('gives every image at least one non-empty subpath', () => {
    for (const holiday of listHolidays()) {
      for (const image of getHolidayContent(holiday).images) {
        expect(image.paths.length).toBeGreaterThan(0);
        expect(image.paths.some(path => path.length > 0)).toBe(true);
      }
    }
  });

  it('uses unique saying and image ids within each holiday', () => {
    for (const holiday of listHolidays()) {
      const content = getHolidayContent(holiday);
      const sayingIds = content.sayings.map(s => s.id);
      const imageIds = content.images.map(i => i.id);
      expect(new Set(sayingIds).size).toBe(sayingIds.length);
      expect(new Set(imageIds).size).toBe(imageIds.length);
    }
  });
});

describe('resolveSaying', () => {
  it('resolves a predefined saying by id', () => {
    const result = resolveSaying('christmas', 'merryChristmas', undefined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('Merry Christmas');
    }
  });

  it('prefers custom sayingText over a sayingId when both are given', () => {
    const result = resolveSaying('christmas', 'merryChristmas', 'Custom Text');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('Custom Text');
    }
  });

  it('trims custom sayingText', () => {
    const result = resolveSaying('christmas', undefined, '  Hi There  ');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('Hi There');
    }
  });

  it('rejects a sayingId that does not belong to the holiday', () => {
    const result = resolveSaying('christmas', 'happyHalloween', undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.field).toBe('sayingId');
    }
  });

  it('rejects when neither sayingId nor sayingText is usable', () => {
    const result = resolveSaying('christmas', undefined, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.field).toBe('sayingText');
    }
    const blank = resolveSaying('christmas', 'other', '   ');
    expect(blank.ok).toBe(false);
  });
});

describe('resolveImage', () => {
  it('returns undefined when no imageId is given', () => {
    const result = resolveImage('halloween', undefined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeUndefined();
    }
  });

  it('resolves a predefined image by id', () => {
    const result = resolveImage('halloween', 'pumpkin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.id).toBe('pumpkin');
    }
  });

  it('rejects an imageId that does not belong to the holiday', () => {
    const result = resolveImage('halloween', 'tree');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.field).toBe('imageId');
    }
  });
});

describe('HOLIDAY_CATALOG keys', () => {
  it('matches listHolidays()', () => {
    expect(Object.keys(HOLIDAY_CATALOG).sort()).toEqual(
      [...listHolidays()].sort(),
    );
  });
});
