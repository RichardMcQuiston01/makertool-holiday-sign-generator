# CHANGELOG

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-18

### Added

- Project scaffolding: TypeScript build (`tsup`, ESM + CJS + type declarations),
  ESLint + Prettier, Vitest, and GitHub Actions CI + npm-publish-on-tag workflows.
- Full Apache License 2.0 text.
- Package configured for publishing as `@richardmcquiston01/holiday-sign-generator`.
- Core domain types (`SignConfig`, `Holiday`, `SignShape`, `MountingConfig`,
  `ScrewSize`, `FontConfig`, `Unit`) describing a holiday sign request.
- Bundled holiday content catalog (`content.ts`): eight holidays (Christmas,
  Halloween, Thanksgiving, Easter, Valentine's Day, St. Patrick's Day, Fourth
  of July, New Year's), each with several predefined sayings and a bundled
  vector image, discoverable via `listHolidays()`/`getHolidayContent()`, plus
  `resolveSaying()`/`resolveImage()` to resolve a config's selection (or
  custom saying text) against the catalog.
- `validateSignConfig()`, which checks a `SignConfig` against every rule
  (holiday must be supported, saying/image must resolve against the
  holiday's catalog, name+font required together, positive heights/margin,
  supported screw size) and returns a typed `Result` with descriptive,
  per-field error messages instead of throwing.
- Font engine (`loadFont`, `getGlyphOutline`, `getTextOutline`,
  `createFontRegistry`), built on `opentype.js`, for extracting vector
  outlines from a TrueType/OpenType font file — for a single character or a
  run of text with kerning applied (the saying/name rows).
- Layout engine (`computeSignLayout`), which turns a validated `SignConfig`
  plus loaded fonts/image into full sign geometry: a sized backer
  (`rectangle`, `square`, `round`, or `ellipse`) that fits the stacked
  image/saying/name content plus margin on every edge, and — for screw
  mounting — two mounting holes sized from the selected screw size.
- `generateSvgFiles(layout, unit)` and `generateDxfFiles(layout, unit)`,
  which turn a computed `SignLayout` into a single `GeneratedFile`: the
  backer's cut outline (and mounting holes) plus the image/saying/name
  engrave artwork, as one physical laser-ready piece. DXF output uses
  [`@tarikjabiri/dxf`](https://www.npmjs.com/package/@tarikjabiri/dxf) with
  `CUT`/`ENGRAVE` layers and flattens curves to polylines; SVG output is
  dependency-free, using `class="cut"`/`class="engrave"` with a black/blue
  stroke convention and physically-sized `width`/`height` attributes (e.g.
  `"4in"`, `"100mm"`).
- `generateSign(options)`, the top-level convenience API: validates a
  `SignConfig`, resolves its saying/image against the holiday catalog and
  its font(s) from a `FontRegistry`, computes the layout, and generates SVG
  and/or DXF files in one call. Returns a typed `Result` whose error is
  tagged with the pipeline stage
  (`'validation' | 'content' | 'font' | 'layout'`) that failed.
- A CLI (`holiday-sign-generator`, `src/cli.ts`) for local testing:
  `holiday-sign-generator --config sign.json --saying-font saying.ttf
[--name-font name.ttf] --out ./dist [--format svg|dxf|both]`.

### Fixed

- **`getGlyphOutline`/`getTextOutline` could crash the whole process** on a
  font using OpenType layout features `opentype.js` doesn't fully support
  (seen with DejaVu Sans's `ccmp` ligature table during an end-to-end CLI
  smoke test) — `opentype.js` throws rather than returning an error there.
  Both functions now catch that and return a descriptive `FontLoadError`
  `Result`, matching every other failure mode in the font/layout pipeline,
  instead of taking down the caller's process.
