/**
 * States and union territories, for the address form.
 *
 * A free-text state field produced "Uttarakhand", "uttarakhand", "UK" and
 * "Uttrakhand" for the same place, which matters more than it looks: the
 * delivery partner matches on it, and GST treatment turns on whether the
 * supply crossed a state line. A fixed list makes that unambiguous.
 *
 * Alphabetical, with union territories after the states, because that is the
 * order people expect to scan.
 */
export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union territories.
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

/** Six digits, first never zero — no Indian PIN code starts with 0. */
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

/**
 * The postal directory spells some states differently from the list above
 * ("Orissa", "Pondicherry"), and an auto-filled value that is not in the
 * dropdown would silently leave the field empty. Anything unrecognised is
 * matched case-insensitively first, and only then given up on.
 */
const ALIASES: Record<string, IndianState> = {
  orissa: 'Odisha',
  pondicherry: 'Puducherry',
  uttaranchal: 'Uttarakhand',
  'nct of delhi': 'Delhi',
  'delhi (nct)': 'Delhi',
  'jammu & kashmir': 'Jammu and Kashmir',
  'andaman & nicobar islands': 'Andaman and Nicobar Islands',
  'dadra & nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'daman & diu': 'Dadra and Nagar Haveli and Daman and Diu',
};

/** Maps whatever the lookup returned onto an option that actually exists. */
export function normaliseState(value: string | undefined | null): IndianState | '' {
  if (!value) return '';
  const trimmed = value.trim();

  const exact = INDIAN_STATES.find((s) => s.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;

  return ALIASES[trimmed.toLowerCase()] ?? '';
}
