# Holiday Sign Generator

## Overview

TypeScript based package for generating cut and engrave files for a holiday-themed sign. Export to SVG and/or DXF files for use in laser cutting software.

- User chooses a Holiday from dropdown list, which acts as a filter for the Holiday Saying and Holiday Image inputs.
- User optionally enters Last Name
- Then, User chooses a saying or phrase from dropdown(e.g. Happy Holidays) or they can select Other and enter their own text.
- Next, User chooses SVG image for sign.
- Options:
  - Sign Shape - Square, Rectangle, Ellipse, Round
  - Holday Saying Font
  - Last Name Font (if Last Name entered)
  - Mounting Type - Screw or Adhesive
- After clicking Generate Sign, user can download SVG and/or DXF files for their holiday sign.

The generated file is a single laser-ready piece: the backer's outer shape
(plus mounting holes, for screw mounting) on a `cut` layer, and the holiday
image/saying/name artwork on an `engrave` layer.

## Getting Started

This package is under active development (see [CHANGELOG.md](./CHANGELOG.md)
for progress).

### Prerequisites

- Node.js >= 18

### Installation

```bash
npm install @richardmcquiston01/holiday-sign-generator
```

### Usage

```ts
import {
  createFontRegistry,
  generateSign,
} from '@richardmcquiston01/holiday-sign-generator';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';

const fonts = createFontRegistry();
const sayingFontBytes = new Uint8Array(readFileSync('./fonts/Pacifico.ttf'))
  .buffer;
fonts.register('saying', sayingFontBytes);

const result = generateSign({
  config: {
    holiday: 'christmas',
    sayingId: 'merryChristmas', // or omit and set sayingText for custom text
    lastName: 'The Smiths', // optional
    imageId: 'tree', // optional — see listHolidays()/getHolidayContent() for options
    font: {sayingFont: 'saying'}, // add nameFont if lastName is set
    shape: 'rectangle', // 'square' | 'rectangle' | 'ellipse' | 'round'
    sayingHeight: 2, // inches
    margin: 0.5,
    unit: 'in',
    mounting: {type: 'screw', screwSize: 'M3'}, // or {type: 'adhesive'}
  },
  fonts,
  format: 'both', // 'svg' | 'dxf' | 'both'
});

if (!result.ok) {
  // result.error.stage is 'validation' | 'content' | 'font' | 'layout'
  throw new Error(`Sign generation failed at ${result.error.stage} stage`);
}

mkdirSync('./output', {recursive: true});
for (const file of result.value) {
  writeFileSync(`./output/${file.name}`, file.content);
}
```

Every holiday's bundled sayings and images are discoverable at runtime via
`listHolidays()` and `getHolidayContent(holiday)` — handy for populating the
dropdowns described above.

### Examples

The package also installs a CLI for local testing, without writing any code:

```bash
npx holiday-sign-generator \
  --config sign.json \
  --saying-font ./fonts/Pacifico.ttf \
  --out ./output
```

Where `sign.json` holds the `SignConfig` fields shown above (minus `font`,
which the CLI fills in from `--saying-font`/`--name-font`):

```json
{
  "holiday": "christmas",
  "sayingId": "merryChristmas",
  "lastName": "The Smiths",
  "imageId": "tree",
  "shape": "rectangle",
  "sayingHeight": 2,
  "margin": 0.5,
  "unit": "in",
  "mounting": {"type": "screw", "screwSize": "M3"}
}
```

## Development

```bash
npm install
npm run build      # compile to dist/ (ESM + CJS + types)
npm test           # run unit tests
npm run lint        # lint with ESLint
npm run format      # format with Prettier
npm run typecheck   # type-check without emitting
```

## Buy Me a Coffee

If this app, code, or repository has helped you or someone you know, please consider donating. I appreciate any help to offset the costs of development and/or AI Credits.

[**Donate via Stripe**](https://donate.stripe.com/00w5kD3Gj1Xo9v7gVOcs800), or scan:

[![Donate via Stripe](./donate.svg)](https://donate.stripe.com/00w5kD3Gj1Xo9v7gVOcs800)

## License

Apache 2

## Copyright

(c)2026 Richard McQuiston. All rights reserved.
