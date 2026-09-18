import {describe, expect, it} from 'vitest';
import type {ScrewSize, SignConfig} from './types.js';
import {validateSignConfig} from './validation.js';

function baseConfig(overrides: Partial<SignConfig> = {}): SignConfig {
  return {
    holiday: 'christmas',
    sayingId: 'merryChristmas',
    font: {sayingFont: 'saying'},
    shape: 'rectangle',
    sayingHeight: 2,
    margin: 0.5,
    unit: 'in',
    mounting: {type: 'adhesive'},
    ...overrides,
  };
}

// exactOptionalPropertyTypes forbids passing `sayingId: undefined` as an
// override, so tests that need it absent strip it from an already-built config.
function withoutSayingId(config: SignConfig): SignConfig {
  const rest: Record<string, unknown> = {...config};
  delete rest.sayingId;
  return rest as unknown as SignConfig;
}

describe('validateSignConfig', () => {
  it('accepts a minimal valid config', () => {
    const result = validateSignConfig(baseConfig());
    expect(result.ok).toBe(true);
  });

  it('rejects an unsupported holiday', () => {
    const result = validateSignConfig(
      baseConfig({holiday: 'groundhogDay' as SignConfig['holiday']}),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContainEqual(
        expect.objectContaining({field: 'holiday'}),
      );
    }
  });

  it('rejects a sayingId from a different holiday', () => {
    const result = validateSignConfig(baseConfig({sayingId: 'happyHalloween'}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContainEqual(
        expect.objectContaining({field: 'sayingId'}),
      );
    }
  });

  it('accepts custom sayingText without a sayingId', () => {
    const result = validateSignConfig(
      withoutSayingId(baseConfig({sayingText: 'Ho Ho Ho'})),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects when neither sayingId nor sayingText is usable', () => {
    const result = validateSignConfig(withoutSayingId(baseConfig()));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContainEqual(
        expect.objectContaining({field: 'sayingText'}),
      );
    }
  });

  it('rejects an imageId that does not belong to the holiday', () => {
    const result = validateSignConfig(baseConfig({imageId: 'pumpkin'}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContainEqual(
        expect.objectContaining({field: 'imageId'}),
      );
    }
  });

  it('rejects a blank lastName', () => {
    const result = validateSignConfig(baseConfig({lastName: '   '}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContainEqual(
        expect.objectContaining({field: 'lastName'}),
      );
    }
  });

  it('requires a nameFont when lastName is provided', () => {
    const result = validateSignConfig(baseConfig({lastName: 'Smith'}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContainEqual(
        expect.objectContaining({field: 'font.nameFont'}),
      );
    }
  });

  it('accepts lastName with a nameFont provided', () => {
    const result = validateSignConfig(
      baseConfig({
        lastName: 'Smith',
        font: {sayingFont: 'saying', nameFont: 'name'},
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a non-positive margin', () => {
    const result = validateSignConfig(baseConfig({margin: 0}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContainEqual(
        expect.objectContaining({field: 'margin'}),
      );
    }
  });

  it('rejects a non-positive sayingHeight', () => {
    const result = validateSignConfig(baseConfig({sayingHeight: -1}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContainEqual(
        expect.objectContaining({field: 'sayingHeight'}),
      );
    }
  });

  it('rejects a non-positive nameHeight when provided', () => {
    const result = validateSignConfig(baseConfig({nameHeight: 0}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContainEqual(
        expect.objectContaining({field: 'nameHeight'}),
      );
    }
  });

  it('rejects a non-positive imageHeight when provided', () => {
    const result = validateSignConfig(baseConfig({imageHeight: -3}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContainEqual(
        expect.objectContaining({field: 'imageHeight'}),
      );
    }
  });

  it('rejects an unsupported screw size', () => {
    const result = validateSignConfig(
      baseConfig({
        mounting: {type: 'screw', screwSize: '5/16-18' as ScrewSize},
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContainEqual(
        expect.objectContaining({field: 'mounting.screwSize'}),
      );
    }
  });

  it('accepts a supported screw size', () => {
    const result = validateSignConfig(
      baseConfig({mounting: {type: 'screw', screwSize: 'M3'}}),
    );
    expect(result.ok).toBe(true);
  });

  it('reports every problem at once', () => {
    const result = validateSignConfig(
      withoutSayingId(
        baseConfig({
          holiday: 'christmas',
          margin: -1,
          sayingHeight: 0,
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThanOrEqual(3);
    }
  });
});
