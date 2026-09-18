import opentype from 'opentype.js';
import {describe, expect, it} from 'vitest';
import {parseArgs, runCli} from './cli.js';
import type {CliArgs, CliDeps} from './cli.js';

describe('parseArgs', () => {
  it('parses a full set of arguments', () => {
    const result = parseArgs([
      '--config',
      'config.json',
      '--saying-font',
      'saying.ttf',
      '--name-font',
      'name.ttf',
      '--out',
      './out',
      '--format',
      'svg',
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        configPath: 'config.json',
        sayingFontPath: 'saying.ttf',
        nameFontPath: 'name.ttf',
        outDir: './out',
        format: 'svg',
      });
    }
  });

  it('defaults format to "both" and omits nameFontPath when not given', () => {
    const result = parseArgs([
      '--config',
      'config.json',
      '--saying-font',
      'saying.ttf',
      '--out',
      './out',
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.format).toBe('both');
      expect(result.value.nameFontPath).toBeUndefined();
    }
  });

  it('rejects a missing --config', () => {
    const result = parseArgs(['--saying-font', 'saying.ttf', '--out', './out']);
    expect(result.ok).toBe(false);
  });

  it('rejects a missing --saying-font', () => {
    const result = parseArgs(['--config', 'config.json', '--out', './out']);
    expect(result.ok).toBe(false);
  });

  it('rejects a missing --out', () => {
    const result = parseArgs([
      '--config',
      'config.json',
      '--saying-font',
      'saying.ttf',
    ]);
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid --format value', () => {
    const result = parseArgs([
      '--config',
      'c.json',
      '--saying-font',
      'f.ttf',
      '--out',
      'o',
      '--format',
      'pdf',
    ]);
    expect(result.ok).toBe(false);
  });

  it('rejects an unrecognized flag', () => {
    const result = parseArgs(['--bogus', 'value']);
    expect(result.ok).toBe(false);
  });

  it('rejects a value flag with no following value', () => {
    const result = parseArgs(['--config']);
    expect(result.ok).toBe(false);
  });
});

function buildTestFontBuffer(characters: string): Buffer {
  const glyphs = [
    new opentype.Glyph({
      name: '.notdef',
      unicode: 0,
      advanceWidth: 300,
      path: new opentype.Path(),
    }),
  ];
  for (const character of characters) {
    const path = new opentype.Path();
    path.moveTo(0, 0);
    path.lineTo(300, 0);
    path.lineTo(300, 700);
    path.lineTo(0, 700);
    path.close();
    glyphs.push(
      new opentype.Glyph({
        name: character,
        unicode: character.charCodeAt(0),
        advanceWidth: 350,
        path,
      }),
    );
  }
  const font = new opentype.Font({
    familyName: 'CLI Test Font',
    styleName: 'Regular',
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs,
  });
  return Buffer.from(font.toArrayBuffer());
}

const TEST_CHARS = 'HapyolidsSmth';

function createFakeFs(files: Record<string, Buffer>): {
  deps: CliDeps;
  written: Map<string, string>;
  createdDirs: string[];
} {
  const written = new Map<string, string>();
  const createdDirs: string[] = [];
  const deps: CliDeps = {
    readFile: path => {
      const content = files[path];
      if (!content) {
        throw new Error(`ENOENT: no such file: ${path}`);
      }
      return content;
    },
    writeFile: (path, content) => {
      written.set(path, content);
    },
    mkdir: path => {
      createdDirs.push(path);
    },
  };
  return {deps, written, createdDirs};
}

describe('runCli', () => {
  const validArgs: CliArgs = {
    configPath: 'config.json',
    sayingFontPath: 'saying.ttf',
    outDir: './out',
    format: 'both',
  };

  it('generates and writes files for a valid config', () => {
    const config = {
      holiday: 'christmas',
      sayingId: 'happyHolidays',
      shape: 'rectangle',
      sayingHeight: 2,
      margin: 0.5,
      unit: 'in',
      mounting: {type: 'adhesive'},
    };
    const {deps, written, createdDirs} = createFakeFs({
      'config.json': Buffer.from(JSON.stringify(config)),
      'saying.ttf': buildTestFontBuffer(TEST_CHARS),
    });

    const result = runCli(validArgs, deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2); // svg + dxf
    }
    expect(createdDirs).toContain('./out');
    expect(written.size).toBe(2);
  });

  it('registers and uses the name font when --name-font is provided', () => {
    const config = {
      holiday: 'christmas',
      sayingId: 'happyHolidays',
      lastName: 'Smith',
      shape: 'rectangle',
      sayingHeight: 2,
      margin: 0.5,
      unit: 'in',
      mounting: {type: 'adhesive'},
    };
    const {deps, written} = createFakeFs({
      'config.json': Buffer.from(JSON.stringify(config)),
      'saying.ttf': buildTestFontBuffer(TEST_CHARS),
      'name.ttf': buildTestFontBuffer(TEST_CHARS),
    });

    const result = runCli(
      {...validArgs, nameFontPath: 'name.ttf', format: 'svg'},
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
    }
    expect([...written.values()][0]).toContain('engrave');
  });

  it('returns an error when the config file cannot be parsed', () => {
    const {deps} = createFakeFs({
      'config.json': Buffer.from('not json'),
      'saying.ttf': buildTestFontBuffer(TEST_CHARS),
    });
    const result = runCli(validArgs, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Failed to read/parse config file');
    }
  });

  it('returns an error when the saying font file is missing', () => {
    const {deps} = createFakeFs({
      'config.json': Buffer.from(
        JSON.stringify({
          holiday: 'christmas',
          sayingId: 'happyHolidays',
          shape: 'rectangle',
          sayingHeight: 2,
          margin: 0.5,
          unit: 'in',
          mounting: {type: 'adhesive'},
        }),
      ),
    });
    const result = runCli(validArgs, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Failed to read saying font file');
    }
  });

  it('returns a formatted validation error for an invalid config', () => {
    const {deps} = createFakeFs({
      'config.json': Buffer.from(
        JSON.stringify({
          holiday: 'christmas',
          sayingId: 'happyHalloween',
          shape: 'rectangle',
          sayingHeight: 2,
          margin: 0.5,
          unit: 'in',
          mounting: {type: 'adhesive'},
        }),
      ),
      'saying.ttf': buildTestFontBuffer(TEST_CHARS),
    });
    const result = runCli(validArgs, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Invalid sign config');
      expect(result.error).toContain('sayingId');
    }
  });
});
