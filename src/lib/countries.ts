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
