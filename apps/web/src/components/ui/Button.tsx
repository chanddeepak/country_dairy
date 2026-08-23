'use client';

import React from 'react';

/**
 * The one button in the redesign.
 *
 * Before this there was no button component and the same class string was
 * retyped at every call site, which is why the old storefront had gold buttons
 * on gold grounds in one place and green on cream in another. A variant here is
 * a decision made once.
 *
 * Square corners, deliberately: the design uses a 2px radius throughout, and a
 * pill button next to a square card is the kind of mixed shape system that
 * reads as unfinished.
 */

type Variant = 'solid' | 'accent' | 'outline' | 'onDark' | 'quiet';
type Size = 'sm' | 'md';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-sm font-sans font-medium ' +
  'uppercase tracking-[0.14em] whitespace-nowrap transition-all duration-300 ' +
  'ease-[cubic-bezier(.2,.7,.3,1)] focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-[var(--brass)] disabled:opacity-50 disabled:pointer-events-none ' +
  'active:translate-y-px';

const VARIANTS: Record<Variant, string> = {
  // The default call to action on a light ground.
  solid: 'bg-[var(--forest)] text-[var(--ivory)] hover:bg-[var(--brass)]',
  // Used once per screen, on the thing we most want pressed.
  accent: 'bg-[var(--brass)] text-[#1a1405] hover:bg-[var(--forest)] hover:text-[var(--ivory)]',
  // Secondary on a light ground.
  outline:
    'border border-[var(--forest)] text-[var(--forest)] hover:bg-[var(--forest)] hover:text-[var(--ivory)]',
  // On photography or a forest band, where a solid dark button would vanish.
  onDark: 'bg-[var(--ivory)] text-[var(--forest)] hover:bg-[var(--brass)] hover:text-[#1a1405]',
  // Reads as a link, sized as a button, so it aligns in a row with real ones.
  quiet: 'text-[var(--forest)] underline-offset-4 hover:text-[var(--brass-text)] hover:underline',
};

const SIZES: Record<Size, string> = {
  sm: 'text-[11px] px-4 py-2.5',
  md: 'text-[12px] px-7 py-4',
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export default function Button({
  variant = 'solid',
  size = 'md',
  className = '',
  ...rest
}: ButtonProps) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...rest} />;
}

/**
 * The same thing that navigates rather than acts.
 *
 * A separate export instead of a polymorphic `as` prop: a link and a button
 * differ in keyboard behaviour, in what the browser does on middle click, and
 * in what a screen reader announces. Making them one component tends to produce
 * a div that is neither.
 */
type ButtonLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  size?: Size;
};

export function ButtonLink({
  variant = 'solid',
  size = 'md',
  className = '',
  ...rest
}: ButtonLinkProps) {
  return <a className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...rest} />;
}

/** The class string on its own, for the places that must render next/link. */
export function buttonClass(variant: Variant = 'solid', size: Size = 'md') {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}
