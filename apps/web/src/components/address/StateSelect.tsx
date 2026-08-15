'use client';

import { INDIAN_STATES } from '../../lib/indianStates';

/**
 * The state dropdown, drawn rather than left to the browser.
 *
 * A native select pins its arrow to the far edge of the control, so on a
 * full-width field it ends up floating a long way from the word it belongs
 * to and reads as a misalignment. Turning the native appearance off and
 * painting the chevron ourselves puts it a consistent 0.75rem in — the same
 * inset as the text padding on every other field in the form — and makes the
 * control look the same in Safari, Chrome and Firefox, which native selects
 * emphatically do not.
 *
 * The right padding is what keeps "Dadra and Nagar Haveli and Daman and Diu"
 * from running underneath it.
 */
const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a8a29e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export default function StateSelect({
  value,
  onChange,
  className = '',
  testId,
  placeholder = 'State',
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  testId?: string;
  placeholder?: string;
}) {
  return (
    <select
      data-testid={testId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        appearance: 'none',
        backgroundImage: CHEVRON,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.75rem center',
      }}
      // Unselected reads as a placeholder, like the inputs beside it; once
      // chosen it is real content and takes the body colour.
      className={`pr-9 ${value ? 'text-[#2A2A2A]' : 'text-stone-400'} ${className}`}
    >
      <option value="">{placeholder}</option>
      {INDIAN_STATES.map((s) => (
        <option key={s} value={s} className="text-[#2A2A2A]">
          {s}
        </option>
      ))}
    </select>
  );
}
