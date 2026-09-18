import type {PathCommand} from './font.js';
import type {Holiday, Result, ValidationError} from './types.js';

/** One predefined saying/phrase option for a holiday. */
export interface SayingOption {
  readonly id: string;
  readonly text: string;
}

/**
 * One predefined image option for a holiday: a bundled vector icon, defined
 * as one or more subpaths in a normalized 100x100, Y-up design box. Scaled
 * and positioned onto the sign by `layout.ts`, the same way glyph outlines
 * from `font.ts` are.
 */
export interface ImageOption {
  readonly id: string;
  readonly label: string;
  readonly paths: readonly (readonly PathCommand[])[];
}

/** The full catalog entry for one holiday: its display label, sayings, and images. */
export interface HolidayContent {
  readonly holiday: Holiday;
  readonly label: string;
  readonly sayings: readonly SayingOption[];
  readonly images: readonly ImageOption[];
}

const DESIGN_BOX_CENTER = 50;

// --- Vector primitive helpers, all in the 100x100 design box (Y-up). ---

function polygon(
  points: readonly (readonly [number, number])[],
): PathCommand[] {
  const [first, ...rest] = points;
  if (!first) return [];
  return [
    {type: 'M', x: first[0], y: first[1]},
    ...rest.map((p): PathCommand => ({type: 'L', x: p[0], y: p[1]})),
    {type: 'Z'},
  ];
}

function line(points: readonly (readonly [number, number])[]): PathCommand[] {
  const [first, ...rest] = points;
  if (!first) return [];
  return [
    {type: 'M', x: first[0], y: first[1]},
    ...rest.map((p): PathCommand => ({type: 'L', x: p[0], y: p[1]})),
  ];
}

// Kappa: the cubic-bezier control-point offset that best approximates a
// quarter circle, used to build ellipse() from 4 cubic segments.
const CIRCLE_KAPPA = 0.5522847498307936;

function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): PathCommand[] {
  const kx = rx * CIRCLE_KAPPA;
  const ky = ry * CIRCLE_KAPPA;
  return [
    {type: 'M', x: cx + rx, y: cy},
    {
      type: 'C',
      x1: cx + rx,
      y1: cy + ky,
      x2: cx + kx,
      y2: cy + ry,
      x: cx,
      y: cy + ry,
    },
    {
      type: 'C',
      x1: cx - kx,
      y1: cy + ry,
      x2: cx - rx,
      y2: cy + ky,
      x: cx - rx,
      y: cy,
    },
    {
      type: 'C',
      x1: cx - rx,
      y1: cy - ky,
      x2: cx - kx,
      y2: cy - ry,
      x: cx,
      y: cy - ry,
    },
    {
      type: 'C',
      x1: cx + kx,
      y1: cy - ry,
      x2: cx + rx,
      y2: cy - ky,
      x: cx + rx,
      y: cy,
    },
    {type: 'Z'},
  ];
}

// A regular star (or, with innerRadius === outerRadius, a regular polygon)
// with `points` outer vertices, centered at (cx, cy).
function star(
  points: number,
  outerRadius: number,
  innerRadius: number,
  cx = DESIGN_BOX_CENTER,
  cy = DESIGN_BOX_CENTER,
): PathCommand[] {
  const vertices: [number, number][] = [];
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + i * step;
    vertices.push([
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle),
    ]);
  }
  return polygon(vertices);
}

// --- Per-holiday bundled images. ---

const CHRISTMAS_TREE: ImageOption = {
  id: 'tree',
  label: 'Christmas Tree',
  paths: [
    polygon([
      [50, 90],
      [38, 60],
      [62, 60],
    ]),
    polygon([
      [50, 68],
      [25, 40],
      [75, 40],
    ]),
    polygon([
      [50, 48],
      [10, 22],
      [90, 22],
    ]),
    polygon([
      [42, 22],
      [58, 22],
      [58, 2],
      [42, 2],
    ]),
  ],
};

const HALLOWEEN_PUMPKIN: ImageOption = {
  id: 'pumpkin',
  label: 'Pumpkin',
  paths: [
    ellipse(50, 42, 38, 32),
    polygon([
      [46, 74],
      [54, 74],
      [56, 92],
      [44, 92],
    ]),
    line([
      [35, 15],
      [40, 42],
      [35, 68],
    ]),
    line([
      [65, 15],
      [60, 42],
      [65, 68],
    ]),
  ],
};

const THANKSGIVING_LEAF: ImageOption = {
  id: 'leaf',
  label: 'Autumn Leaf',
  paths: [
    polygon([
      [50, 95],
      [70, 80],
      [80, 55],
      [75, 30],
      [60, 15],
      [50, 5],
      [40, 15],
      [25, 30],
      [20, 55],
      [30, 80],
    ]),
    line([
      [50, 90],
      [50, 8],
    ]),
    line([
      [50, 5],
      [44, -4],
    ]),
  ],
};

const EASTER_EGG: ImageOption = {
  id: 'egg',
  label: 'Easter Egg',
  paths: [
    ellipse(50, 48, 28, 42),
    line([
      [24, 62],
      [40, 68],
      [50, 60],
      [60, 68],
      [76, 62],
    ]),
    line([
      [26, 38],
      [42, 44],
      [50, 36],
      [58, 44],
      [74, 38],
    ]),
  ],
};

const VALENTINES_HEART: ImageOption = {
  id: 'heart',
  label: 'Heart',
  paths: [
    ellipse(32, 64, 22, 20),
    ellipse(68, 64, 22, 20),
    polygon([
      [10, 58],
      [90, 58],
      [50, 8],
    ]),
  ],
};

const ST_PATRICKS_SHAMROCK: ImageOption = {
  id: 'shamrock',
  label: 'Shamrock',
  paths: [
    ellipse(50, 72, 18, 18),
    ellipse(32, 45, 18, 18),
    ellipse(68, 45, 18, 18),
    [
      {type: 'M', x: 50, y: 45},
      {type: 'C', x1: 40, y1: 30, x2: 60, y2: 15, x: 50, y: 2},
    ],
  ],
};

const FOURTH_OF_JULY_STAR: ImageOption = {
  id: 'star',
  label: 'Star',
  paths: [star(5, 45, 18)],
};

const NEW_YEAR_SPARKLE: ImageOption = {
  id: 'sparkle',
  label: 'Sparkle Burst',
  paths: [star(8, 45, 12)],
};

/** Bundled holiday content: display labels, predefined sayings, and vector images. */
export const HOLIDAY_CATALOG: Readonly<Record<Holiday, HolidayContent>> = {
  christmas: {
    holiday: 'christmas',
    label: 'Christmas',
    sayings: [
      {id: 'happyHolidays', text: 'Happy Holidays'},
      {id: 'merryChristmas', text: 'Merry Christmas'},
      {id: 'seasonsGreetings', text: "Season's Greetings"},
    ],
    images: [CHRISTMAS_TREE],
  },
  halloween: {
    holiday: 'halloween',
    label: 'Halloween',
    sayings: [
      {id: 'happyHalloween', text: 'Happy Halloween'},
      {id: 'trickOrTreat', text: 'Trick or Treat'},
      {id: 'boo', text: 'Boo!'},
    ],
    images: [HALLOWEEN_PUMPKIN],
  },
  thanksgiving: {
    holiday: 'thanksgiving',
    label: 'Thanksgiving',
    sayings: [
      {id: 'happyThanksgiving', text: 'Happy Thanksgiving'},
      {id: 'gratefulThankfulBlessed', text: 'Grateful Thankful Blessed'},
      {id: 'giveThanks', text: 'Give Thanks'},
    ],
    images: [THANKSGIVING_LEAF],
  },
  easter: {
    holiday: 'easter',
    label: 'Easter',
    sayings: [
      {id: 'happyEaster', text: 'Happy Easter'},
      {id: 'heIsRisen', text: 'He Is Risen'},
      {id: 'springHasSprung', text: 'Spring Has Sprung'},
    ],
    images: [EASTER_EGG],
  },
  valentinesDay: {
    holiday: 'valentinesDay',
    label: "Valentine's Day",
    sayings: [
      {id: 'happyValentinesDay', text: "Happy Valentine's Day"},
      {id: 'beMine', text: 'Be Mine'},
      {id: 'loveIsInTheAir', text: 'Love Is In The Air'},
    ],
    images: [VALENTINES_HEART],
  },
  stPatricksDay: {
    holiday: 'stPatricksDay',
    label: "St. Patrick's Day",
    sayings: [
      {id: 'happyStPatricksDay', text: "Happy St. Patrick's Day"},
      {id: 'luckOfTheIrish', text: 'Luck of the Irish'},
      {id: 'feelingLucky', text: 'Feeling Lucky'},
    ],
    images: [ST_PATRICKS_SHAMROCK],
  },
  fourthOfJuly: {
    holiday: 'fourthOfJuly',
    label: 'Fourth of July',
    sayings: [
      {id: 'happyFourthOfJuly', text: 'Happy 4th of July'},
      {id: 'landOfTheFree', text: 'Land of the Free'},
      {id: 'homeOfTheBrave', text: 'Home of the Brave'},
    ],
    images: [FOURTH_OF_JULY_STAR],
  },
  newYear: {
    holiday: 'newYear',
    label: "New Year's",
    sayings: [
      {id: 'happyNewYear', text: 'Happy New Year'},
      {id: 'cheersToTheNewYear', text: 'Cheers to the New Year'},
      {id: 'newBeginnings', text: 'New Beginnings'},
    ],
    images: [NEW_YEAR_SPARKLE],
  },
};

/** All supported holidays, in catalog order. */
export function listHolidays(): readonly Holiday[] {
  return Object.keys(HOLIDAY_CATALOG) as Holiday[];
}

/** Looks up a holiday's bundled content (sayings and images). */
export function getHolidayContent(holiday: Holiday): HolidayContent {
  return HOLIDAY_CATALOG[holiday];
}

/**
 * Resolves the saying text to render: custom {@link sayingText} always wins
 * when provided; otherwise {@link sayingId} must name a saying in the
 * holiday's catalog.
 */
export function resolveSaying(
  holiday: Holiday,
  sayingId: string | undefined,
  sayingText: string | undefined,
): Result<string, ValidationError> {
  if (sayingText !== undefined && sayingText.trim().length > 0) {
    return {ok: true, value: sayingText.trim()};
  }

  if (sayingId !== undefined && sayingId !== 'other') {
    const match = getHolidayContent(holiday).sayings.find(
      s => s.id === sayingId,
    );
    if (match) {
      return {ok: true, value: match.text};
    }
    return {
      ok: false,
      error: {
        field: 'sayingId',
        message: `"${sayingId}" is not a saying for holiday "${holiday}". Provide a valid sayingId or custom sayingText.`,
      },
    };
  }

  return {
    ok: false,
    error: {
      field: 'sayingText',
      message:
        'Provide either a sayingId from the holiday catalog or custom sayingText.',
    },
  };
}

/** Resolves an optional image selection against the holiday's catalog. */
export function resolveImage(
  holiday: Holiday,
  imageId: string | undefined,
): Result<ImageOption | undefined, ValidationError> {
  if (imageId === undefined) {
    return {ok: true, value: undefined};
  }
  const match = getHolidayContent(holiday).images.find(i => i.id === imageId);
  if (!match) {
    return {
      ok: false,
      error: {
        field: 'imageId',
        message: `"${imageId}" is not an image for holiday "${holiday}".`,
      },
    };
  }
  return {ok: true, value: match};
}
