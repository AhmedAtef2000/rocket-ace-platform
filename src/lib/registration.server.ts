// Server-only validation helpers for registration and flexible sign-in.

export type RegistrationInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** E.164-ish normalisation: digits only, leading + preserved. */
export function normalizePhone(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) {
    throw new Error("Enter a valid phone number including country code.");
  }
  return `+${digits}`;
}

export function normalizeEmail(raw: string): string {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

export function isEmailLike(value: string): boolean {
  return value.includes("@");
}

/** Shared with the client so the form and the server agree on the rules. */
export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 10) problems.push("at least 10 characters");
  if (!/[a-z]/.test(password)) problems.push("a lowercase letter");
  if (!/[A-Z]/.test(password)) problems.push("an uppercase letter");
  if (!/\d/.test(password)) problems.push("a number");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("a symbol");
  return problems;
}

export function assertAdult(dateOfBirth: string): string {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) throw new Error("Enter a valid date of birth.");
  const eighteen = new Date();
  eighteen.setFullYear(eighteen.getFullYear() - 18);
  if (dob > eighteen) throw new Error("You must be at least 18 years old to register.");
  return dob.toISOString().slice(0, 10);
}

export function parseRegistration(data: unknown): RegistrationInput {
  const d = (data ?? {}) as Record<string, unknown>;
  const name = (value: unknown, label: string) => {
    const text = String(value ?? "").trim();
    if (text.length < 2 || text.length > 60) throw new Error(`Enter a valid ${label}.`);
    return text;
  };
  return {
    firstName: name(d["firstName"], "first name"),
    lastName: name(d["lastName"], "last name"),
    dateOfBirth: assertAdult(String(d["dateOfBirth"] ?? "")),
    email: normalizeEmail(String(d["email"] ?? "")),
    phone: normalizePhone(String(d["phone"] ?? "")),
  };
}