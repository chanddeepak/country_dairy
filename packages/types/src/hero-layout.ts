/**
 * How a hero banner's text is placed and set.
 *
 * Deliberately not a freeform canvas. A pixel position dragged on a 1440px
 * editor is wrong on a 390px phone — the text lands off the artwork or over
 * the subject's face — so the editor drags onto a 3×3 anchor grid and stores
 * the anchor, not coordinates. Size, font and colour come from fixed scales
 * rather than open inputs, because a hero that stops matching the rest of the
 * site is a worse outcome than one that cannot be nudged two pixels left.
 *
 * Both apps read this file: the admin editor writes it, the storefront renders
 * it, and neither is free to invent a value the other does not know.
 */

/** Nine positions, read like a phone keypad. */
export const HERO_ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;

export type HeroAnchor = (typeof HERO_ANCHORS)[number];

export const HERO_SIZES = ['S', 'M', 'L', 'XL'] as const;
export type HeroSize = (typeof HERO_SIZES)[number];

/** Roles, not typefaces. The theme decides what each one actually is. */
export const HERO_FONTS = ['display', 'body'] as const;
export type HeroFont = (typeof HERO_FONTS)[number];

export const HERO_ALIGNMENTS = ['left', 'center', 'right'] as const;
export type HeroAlignment = (typeof HERO_ALIGNMENTS)[number];

/**
 * Palette entries rather than hex values.
 *
 * `auto` picks light or dark from the scrim, which is what keeps white text
 * off a white cow.
 */
export const HERO_COLORS = ['auto', 'light', 'dark', 'gold'] as const;
export type HeroColor = (typeof HERO_COLORS)[number];

/** How hard the image is darkened behind the text. */
export const HERO_SCRIMS = ['none', 'soft', 'strong', 'gradient'] as const;
export type HeroScrim = (typeof HERO_SCRIMS)[number];

export interface HeroLayout {
  /** Bumped when the shape changes, so an old banner keeps rendering. */
  version: 1;
  anchor: HeroAnchor;
  /**
   * Fine adjustment from the anchor, as a percentage of the banner box.
   * Kept small on purpose — this is a nudge, not free placement.
   */
  offset: { x: number; y: number };
  align: HeroAlignment;
  size: HeroSize;
  font: HeroFont;
  color: HeroColor;
  scrim: HeroScrim;
  /** Percentage of the banner width the text block may occupy. */
  maxWidth: number;
}

export const DEFAULT_HERO_LAYOUT: HeroLayout = {
  version: 1,
  anchor: 'middle-left',
  offset: { x: 0, y: 0 },
  align: 'left',
  size: 'L',
  font: 'display',
  color: 'auto',
  scrim: 'gradient',
  maxWidth: 50,
};

const NUDGE_LIMIT = 15;

function oneOf<T extends readonly string[]>(
  list: T,
  value: unknown,
  fallback: T[number],
): T[number] {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Reads whatever is in the database into a layout that renders.
 *
 * Never throws and never returns a partial: a banner with a null, malformed or
 * half-written layout falls back to the default rather than rendering with an
 * undefined anchor. The homepage is the first thing every visitor sees, and it
 * failing over a bad CMS value is not a trade worth making.
 */
export function parseHeroLayout(raw: unknown): HeroLayout {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_HERO_LAYOUT };

  const value = raw as Record<string, unknown>;
  const offset = (value.offset ?? {}) as Record<string, unknown>;

  return {
    version: 1,
    anchor: oneOf(HERO_ANCHORS, value.anchor, DEFAULT_HERO_LAYOUT.anchor),
    offset: {
      x: clamp(offset.x, -NUDGE_LIMIT, NUDGE_LIMIT, 0),
      y: clamp(offset.y, -NUDGE_LIMIT, NUDGE_LIMIT, 0),
    },
    align: oneOf(HERO_ALIGNMENTS, value.align, DEFAULT_HERO_LAYOUT.align),
    size: oneOf(HERO_SIZES, value.size, DEFAULT_HERO_LAYOUT.size),
    font: oneOf(HERO_FONTS, value.font, DEFAULT_HERO_LAYOUT.font),
    color: oneOf(HERO_COLORS, value.color, DEFAULT_HERO_LAYOUT.color),
    scrim: oneOf(HERO_SCRIMS, value.scrim, DEFAULT_HERO_LAYOUT.scrim),
    maxWidth: clamp(value.maxWidth, 20, 100, DEFAULT_HERO_LAYOUT.maxWidth),
  };
}

/** Which corner of the text block is pinned, per anchor. */
export function anchorPlacement(anchor: HeroAnchor): {
  vertical: 'start' | 'center' | 'end';
  horizontal: 'start' | 'center' | 'end';
} {
  const [row, column] = anchor.split('-') as [string, string];

  return {
    vertical: row === 'top' ? 'start' : row === 'bottom' ? 'end' : 'center',
    horizontal: column === 'left' ? 'start' : column === 'right' ? 'end' : 'center',
  };
}
