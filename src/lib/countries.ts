/** Dial codes + default account currency per country, used by geo detection and phone inputs. */
export type Country = { iso: string; name: string; dial: string; currency: "USD" | "EUR" | "EGP" };

export const COUNTRIES: Country[] = [
  { iso: "EG", name: "Egypt", dial: "+20", currency: "EGP" },
  { iso: "US", name: "United States", dial: "+1", currency: "USD" },
  { iso: "CA", name: "Canada", dial: "+1", currency: "USD" },
  { iso: "GB", name: "United Kingdom", dial: "+44", currency: "EUR" },
  { iso: "IE", name: "Ireland", dial: "+353", currency: "EUR" },
  { iso: "DE", name: "Germany", dial: "+49", currency: "EUR" },
  { iso: "AT", name: "Austria", dial: "+43", currency: "EUR" },
  { iso: "CH", name: "Switzerland", dial: "+41", currency: "EUR" },
  { iso: "FR", name: "France", dial: "+33", currency: "EUR" },
  { iso: "ES", name: "Spain", dial: "+34", currency: "EUR" },
  { iso: "IT", name: "Italy", dial: "+39", currency: "EUR" },
  { iso: "NL", name: "Netherlands", dial: "+31", currency: "EUR" },
  { iso: "BE", name: "Belgium", dial: "+32", currency: "EUR" },
  { iso: "PT", name: "Portugal", dial: "+351", currency: "EUR" },
  { iso: "GR", name: "Greece", dial: "+30", currency: "EUR" },
  { iso: "PL", name: "Poland", dial: "+48", currency: "EUR" },
  { iso: "SE", name: "Sweden", dial: "+46", currency: "EUR" },
  { iso: "NO", name: "Norway", dial: "+47", currency: "EUR" },
  { iso: "DK", name: "Denmark", dial: "+45", currency: "EUR" },
  { iso: "FI", name: "Finland", dial: "+358", currency: "EUR" },
  { iso: "CZ", name: "Czechia", dial: "+420", currency: "EUR" },
  { iso: "RO", name: "Romania", dial: "+40", currency: "EUR" },
  { iso: "TR", name: "Türkiye", dial: "+90", currency: "EUR" },
  { iso: "SA", name: "Saudi Arabia", dial: "+966", currency: "USD" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971", currency: "USD" },
  { iso: "QA", name: "Qatar", dial: "+974", currency: "USD" },
  { iso: "KW", name: "Kuwait", dial: "+965", currency: "USD" },
  { iso: "BH", name: "Bahrain", dial: "+973", currency: "USD" },
  { iso: "OM", name: "Oman", dial: "+968", currency: "USD" },
  { iso: "JO", name: "Jordan", dial: "+962", currency: "USD" },
  { iso: "LB", name: "Lebanon", dial: "+961", currency: "USD" },
  { iso: "IQ", name: "Iraq", dial: "+964", currency: "USD" },
  { iso: "MA", name: "Morocco", dial: "+212", currency: "USD" },
  { iso: "DZ", name: "Algeria", dial: "+213", currency: "USD" },
  { iso: "TN", name: "Tunisia", dial: "+216", currency: "USD" },
  { iso: "LY", name: "Libya", dial: "+218", currency: "USD" },
  { iso: "SD", name: "Sudan", dial: "+249", currency: "USD" },
  { iso: "NG", name: "Nigeria", dial: "+234", currency: "USD" },
  { iso: "KE", name: "Kenya", dial: "+254", currency: "USD" },
  { iso: "ZA", name: "South Africa", dial: "+27", currency: "USD" },
  { iso: "IN", name: "India", dial: "+91", currency: "USD" },
  { iso: "PK", name: "Pakistan", dial: "+92", currency: "USD" },
  { iso: "BD", name: "Bangladesh", dial: "+880", currency: "USD" },
  { iso: "ID", name: "Indonesia", dial: "+62", currency: "USD" },
  { iso: "PH", name: "Philippines", dial: "+63", currency: "USD" },
  { iso: "MY", name: "Malaysia", dial: "+60", currency: "USD" },
  { iso: "SG", name: "Singapore", dial: "+65", currency: "USD" },
  { iso: "AU", name: "Australia", dial: "+61", currency: "USD" },
  { iso: "NZ", name: "New Zealand", dial: "+64", currency: "USD" },
  { iso: "BR", name: "Brazil", dial: "+55", currency: "USD" },
  { iso: "AR", name: "Argentina", dial: "+54", currency: "USD" },
  { iso: "MX", name: "Mexico", dial: "+52", currency: "USD" },
  { iso: "JP", name: "Japan", dial: "+81", currency: "USD" },
  { iso: "KR", name: "South Korea", dial: "+82", currency: "USD" },
];

export const DEFAULT_COUNTRY = "US";

export function countryByIso(iso: string | null | undefined): Country | undefined {
  if (!iso) return undefined;
  return COUNTRIES.find((c) => c.iso === iso.toUpperCase());
}

export function dialFor(iso: string): string {
  return countryByIso(iso)?.dial ?? "+1";
}

/** Strips a pasted dial code / trunk zero so the code is never duplicated in the number box. */
export function stripDial(value: string, dial: string): string {
  const raw = String(value ?? "");
  let digits = raw.replace(/[^\d]/g, "");
  const code = dial.replace(/[^\d]/g, "");
  // Only treat a leading dial code as duplicated when a full local number follows,
  // or when the user explicitly typed it with a leading "+".
  const typedPlus = raw.trim().startsWith("+");
  while (
    code &&
    digits.startsWith(code) &&
    (typedPlus || digits.length >= code.length + 7)
  ) {
    digits = digits.slice(code.length);
  }
  return digits.replace(/^0+/, "");
}

/** Builds the E.164 value sent to the server. */
export function composePhone(dial: string, local: string): string {
  return `${dial}${stripDial(local, dial)}`;
}

/**
 * Expected local (national) number length per country. Countries not listed
 * fall back to a permissive but still meaningful 6–13 digit range.
 */
const PHONE_LENGTHS: Record<string, [number, number]> = {
  EG: [10, 10], US: [10, 10], CA: [10, 10], GB: [10, 10], IE: [9, 9],
  DE: [10, 11], AT: [10, 11], CH: [9, 9], FR: [9, 9], ES: [9, 9],
  IT: [9, 10], NL: [9, 9], BE: [9, 9], PT: [9, 9], GR: [10, 10],
  PL: [9, 9], SE: [9, 9], NO: [8, 8], DK: [8, 8], FI: [9, 10],
  CZ: [9, 9], RO: [9, 9], TR: [10, 10], SA: [9, 9], AE: [9, 9],
  QA: [8, 8], KW: [8, 8], BH: [8, 8], OM: [8, 8], JO: [9, 9],
  LB: [7, 8], IQ: [10, 10], MA: [9, 9], DZ: [9, 9], TN: [8, 8],
  LY: [9, 9], SD: [9, 9], NG: [10, 10], KE: [9, 9], ZA: [9, 9],
  IN: [10, 10], PK: [10, 10], BD: [10, 10], ID: [9, 12], PH: [10, 10],
  MY: [9, 10], SG: [8, 8], AU: [9, 9], NZ: [8, 10], BR: [10, 11],
  AR: [10, 10], MX: [10, 10], JP: [10, 10], KR: [9, 10],
};

export function phoneLengthRange(iso: string): [number, number] {
  return PHONE_LENGTHS[iso.toUpperCase()] ?? [6, 13];
}

/** Human-readable expected digit count, e.g. "10" or "9–10". */
export function phoneLengthHint(iso: string): string {
  const [min, max] = phoneLengthRange(iso);
  return min === max ? String(min) : `${min}–${max}`;
}

/** Returns true when the local number has a plausible length for the country. */
export function isValidLocalPhone(iso: string, local: string): boolean {
  const digits = stripDial(local, dialFor(iso));
  const [min, max] = phoneLengthRange(iso);
  return digits.length >= min && digits.length <= max;
}
