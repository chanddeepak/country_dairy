import { useRef, useState } from 'react';
import { resolveImageUrl } from './common/ImageUploader';
import {
  DEFAULT_HERO_LAYOUT,
  HERO_ANCHORS,
  HERO_ALIGNMENTS,
  HERO_COLORS,
  HERO_FONTS,
  HERO_SCRIMS,
  HERO_SIZES,
  parseHeroLayout,
  type HeroAnchor,
  type HeroLayout,
} from '@country-dairy/types';

/**
 * Places the text on a hero banner by dragging it onto a 3×3 grid.
 *
 * Deliberately not a freeform canvas. A pixel position dragged against a
 * desktop-width preview is wrong on a phone — the text lands off the artwork
 * or over the subject's face — so what is stored is an anchor and a small
 * nudge, both relative, which hold at any width. Size, font and colour come
 * from fixed scales for the same reason a brand has a style guide.
 *
 * The preview uses the storefront's own class rules, so what is dragged here
 * is what ships. A preview that only approximates the real thing is worse than
 * none: someone positions against it and something else goes out.
 */

/**
 * Turns an anchor into CSS that keeps the block inside the frame.
 *
 * The obvious version — pin every anchor at a point and translate(-50%, -50%)
 * — pushes a left-anchored block half its own width off the left edge, which
 * is exactly what it did: a 50%-wide block at left:16% started at -9% and the
 * headline was cut in half. Only the middle row and centre column get pulled
 * back; the outer ones are pinned by the edge they belong to.
 */
function anchorStyle(anchor: HeroAnchor, offsetX: number, offsetY: number): React.CSSProperties {
  const [row, column] = anchor.split('-') as [string, string];
  const INSET = '6%';

  const horizontal: React.CSSProperties =
    column === 'left'
      ? { left: INSET }
      : column === 'right'
        ? { right: INSET }
        : { left: '50%' };

  const vertical: React.CSSProperties =
    row === 'top' ? { top: INSET } : row === 'bottom' ? { bottom: INSET } : { top: '50%' };

  const pullX = column === 'center' ? '-50%' : '0%';
  const pullY = row === 'middle' ? '-50%' : '0%';

  return {
    ...horizontal,
    ...vertical,
    transform: `translate(calc(${pullX} + ${offsetX}%), calc(${pullY} + ${offsetY}%))`,
  };
}

/** The anchor whose cell contains this point, as a fraction of the box. */
function anchorAt(xFraction: number, yFraction: number): HeroAnchor {
  const column = xFraction < 1 / 3 ? 'left' : xFraction < 2 / 3 ? 'center' : 'right';
  const row = yFraction < 1 / 3 ? 'top' : yFraction < 2 / 3 ? 'middle' : 'bottom';
  return `${row}-${column}` as HeroAnchor;
}

const SIZE_PREVIEW = { S: 'text-xs', M: 'text-sm', L: 'text-base', XL: 'text-lg' } as const;
const SCRIM_PREVIEW = {
  none: '',
  soft: 'bg-black/25',
  strong: 'bg-black/50',
  gradient: 'bg-gradient-to-r from-black/60 via-black/35 to-transparent',
} as const;
const COLOR_PREVIEW = {
  auto: 'text-white',
  light: 'text-white',
  dark: 'text-stone-900',
  gold: 'text-[#C59B27]',
} as const;

interface Props {
  value: unknown;
  onChange: (layout: HeroLayout) => void;
  imageUrl?: string;
  title: string;
  subtitle?: string;
}

export default function HeroLayoutEditor({ value, onChange, imageUrl, title, subtitle }: Props) {
  const layout = parseHeroLayout(value);
  // The stored path is relative to object storage, which the console cannot
  // serve itself — the same resolver every other admin image goes through.
  const resolvedImage = resolveImageUrl(imageUrl);
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const set = <K extends keyof HeroLayout>(key: K, next: HeroLayout[K]) =>
    onChange({ ...layout, [key]: next });

  /** Snaps to whichever cell the pointer is over, and clears any nudge. */
  const snapTo = (clientX: number, clientY: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;

    const anchor = anchorAt((clientX - box.left) / box.width, (clientY - box.top) / box.height);
    // A nudge belongs to the anchor it was made against; carrying it across
    // would move the text somewhere nobody chose.
    onChange({ ...layout, anchor, offset: { x: 0, y: 0 } });
  };

  const placement = anchorStyle(layout.anchor, layout.offset.x, layout.offset.y);

  return (
    <div className="space-y-4">
      <div
        ref={boxRef}
        data-testid="hero-layout-canvas"
        onPointerMove={(e) => dragging && snapTo(e.clientX, e.clientY)}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
        className="relative w-full aspect-[21/9] rounded-xl overflow-hidden border border-stone-200 bg-stone-800 select-none"
      >
        {resolvedImage ? (
          <img src={resolvedImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          // Said plainly rather than left as a broken image icon: a banner
          // with no artwork yet is a normal state, not a fault.
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-stone-400">
            Upload artwork to preview placement
          </div>
        )}
        <div className={`absolute inset-0 ${SCRIM_PREVIEW[layout.scrim]}`} />

        {/* The nine cells, shown while dragging so the target is obvious. */}
        <div
          className={`absolute inset-0 grid grid-cols-3 grid-rows-3 transition-opacity ${
            dragging ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {HERO_ANCHORS.map((anchor) => (
            <button
              key={anchor}
              type="button"
              data-testid={`hero-anchor-${anchor}`}
              onClick={() => onChange({ ...layout, anchor, offset: { x: 0, y: 0 } })}
              className={`border border-dashed border-white/30 ${
                layout.anchor === anchor ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
              aria-label={`Place text ${anchor.replace('-', ' ')}`}
            />
          ))}
        </div>

        <div
          data-testid="hero-text-block"
          onPointerDown={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          style={{ ...placement, maxWidth: `${layout.maxWidth}%` }}
          className={`absolute z-10 cursor-grab active:cursor-grabbing px-2 ${
            layout.align === 'left'
              ? 'text-left'
              : layout.align === 'right'
                ? 'text-right'
                : 'text-center'
          } ${dragging ? 'ring-2 ring-white/70 rounded' : ''}`}
        >
          <p
            className={`${SIZE_PREVIEW[layout.size]} ${COLOR_PREVIEW[layout.color]} ${
              layout.font === 'display' ? 'font-serif font-black' : 'font-sans font-bold'
            } leading-tight drop-shadow`}
          >
            {title || 'Headline'}
          </p>
          {subtitle && (
            <p className="text-[10px] text-white/85 mt-1 leading-snug drop-shadow">{subtitle}</p>
          )}
        </div>

        <p className="absolute bottom-1.5 right-2 text-[10px] text-white/70 font-medium">
          Drag the text, or click a cell
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Choice label="Size" options={HERO_SIZES} value={layout.size} onPick={(v) => set('size', v)} />
        <Choice label="Font" options={HERO_FONTS} value={layout.font} onPick={(v) => set('font', v)} />
        <Choice
          label="Align"
          options={HERO_ALIGNMENTS}
          value={layout.align}
          onPick={(v) => set('align', v)}
        />
        <Choice
          label="Colour"
          options={HERO_COLORS}
          value={layout.color}
          onPick={(v) => set('color', v)}
        />
        <Choice
          label="Scrim"
          options={HERO_SCRIMS}
          value={layout.scrim}
          onPick={(v) => set('scrim', v)}
        />

        <div className="space-y-1">
          <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">
            Text width — {layout.maxWidth}%
          </label>
          <input
            type="range"
            min={20}
            max={100}
            step={5}
            value={layout.maxWidth}
            data-testid="hero-max-width"
            onChange={(e) => set('maxWidth', Number(e.target.value))}
            className="w-full accent-[#064e3b]"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-stone-500">
          Position is stored as a grid anchor, not pixels, so it holds on a phone as well as a
          desktop.
        </p>
        <button
          type="button"
          data-testid="hero-layout-reset"
          onClick={() => onChange({ ...DEFAULT_HERO_LAYOUT })}
          className="text-xs font-bold text-stone-500 hover:text-stone-800 underline"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function Choice<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onPick: (value: T) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">{label}</label>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`hero-${label.toLowerCase()}-${option}`}
            onClick={() => onPick(option)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition capitalize ${
              value === option
                ? 'bg-[#064e3b] text-white border-[#064e3b]'
                : 'bg-white text-stone-600 border-stone-200 hover:border-[#064e3b]'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
