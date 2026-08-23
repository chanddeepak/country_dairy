import {
  anchorPlacement,
  parseHeroLayout,
  type HeroLayout,
} from '@country-dairy/types';

export { parseHeroLayout };
export type { HeroLayout };

/**
 * Turns a stored layout into the classes that place and set the text.
 *
 * Lives here rather than in the component so the admin preview can render a
 * banner with exactly the same rules the storefront uses. A preview that
 * approximates the real thing is worse than no preview — someone positions
 * text against it and ships something else.
 */

const FLEX_ALIGN = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
} as const;

const FLEX_JUSTIFY = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
} as const;

const TEXT_ALIGN = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

/** Four steps, each already responsive. */
const HEADLINE_SIZE = {
  S: 'text-xl sm:text-2xl md:text-3xl',
  M: 'text-2xl sm:text-3xl md:text-4xl',
  L: 'text-3xl sm:text-4xl md:text-5xl',
  XL: 'text-4xl sm:text-5xl md:text-6xl',
} as const;

const SUBTITLE_SIZE = {
  S: 'text-xs md:text-sm',
  M: 'text-sm md:text-base',
  L: 'text-sm md:text-base',
  XL: 'text-base md:text-lg',
} as const;

const FONT = {
  display: 'font-serif font-light',
  body: 'font-sans font-bold',
} as const;

/** `auto` is resolved from the scrim, which is what keeps text legible. */
const TEXT_COLOR = {
  light: 'text-white',
  dark: 'text-[var(--ink)]',
  gold: 'text-[var(--brass)]',
} as const;

const SCRIM = {
  none: '',
  soft: 'bg-black/25',
  strong: 'bg-black/50',
  gradient: 'bg-gradient-to-r from-black/60 via-black/35 to-transparent',
} as const;

export interface HeroLayoutClasses {
  /** On the full-bleed container that positions the block. */
  container: string;
  /** On the text block itself. */
  block: string;
  headline: string;
  subtitle: string;
  /** Inline style for the nudge, which has no sensible class. */
  blockStyle: React.CSSProperties;
  scrim: string;
}

export function heroLayoutClasses(raw: unknown): HeroLayoutClasses {
  const layout = parseHeroLayout(raw);
  const { vertical, horizontal } = anchorPlacement(layout.anchor);

  // A gradient or dark scrim means light text; without one, honour the choice
  // and default to dark so text is not white on a pale photograph.
  const resolvedColor =
    layout.color === 'auto'
      ? layout.scrim === 'none'
        ? 'dark'
        : 'light'
      : layout.color;

  return {
    container: `flex ${FLEX_ALIGN[vertical]} ${FLEX_JUSTIFY[horizontal]}`,
    block: `space-y-3.5 ${TEXT_ALIGN[layout.align]}`,
    headline: `${FONT[layout.font]} leading-tight drop-shadow-lg ${HEADLINE_SIZE[layout.size]} ${TEXT_COLOR[resolvedColor]}`,
    subtitle: `${SUBTITLE_SIZE[layout.size]} leading-relaxed drop-shadow ${
      resolvedColor === 'dark' ? 'text-[var(--ink)]' : 'text-white/90'
    }`,
    blockStyle: {
      maxWidth: `${layout.maxWidth}%`,
      // Percentages of the banner box, so the nudge scales with the image
      // rather than drifting on a narrower screen.
      transform: `translate(${layout.offset.x}%, ${layout.offset.y}%)`,
    },
    scrim: SCRIM[layout.scrim],
  };
}
