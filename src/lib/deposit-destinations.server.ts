// Admin-managed deposit destinations: crypto wallet addresses and local cash
// phone numbers players send funds to. Editable at any time from Settings.
export const DESTINATION_KINDS = ["CRYPTO", "MANUAL"] as const;
export type DestinationKind = (typeof DESTINATION_KINDS)[number];

export type DestinationInput = {
  id: string | null;
  kind: DestinationKind;
  currency: string;
  channel: string;
  label: string;
  address: string;
  memo: string | null;
  instructions: string | null;
  active: boolean;
  sortOrder: number;
};

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseDestinationInput(raw: unknown): DestinationInput {
  const d = (raw ?? {}) as Record<string, unknown>;
  const kind = text(d["kind"], 10).toUpperCase() as DestinationKind;
  if (!DESTINATION_KINDS.includes(kind)) throw new Error("Choose crypto or local cash.");

  const currency = text(d["currency"], 10).toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(currency)) throw new Error("Enter a valid currency code.");

  const channel = text(d["channel"], 40).toUpperCase().replace(/\s+/g, "_");
  if (!/^[A-Z0-9_]{2,40}$/.test(channel)) {
    throw new Error(kind === "CRYPTO" ? "Enter a valid network." : "Enter a valid method code.");
  }

  const address = text(d["address"], 200);
  if (kind === "CRYPTO") {
    if (address.length < 12) throw new Error("Enter a valid wallet address.");
  } else if (!/^[+0-9][0-9\s()+-]{5,31}$/.test(address)) {
    throw new Error("Enter a valid phone number.");
  }

  const sortRaw = Number(d["sortOrder"]);
  const idRaw = text(d["id"], 60);

  return {
    id: idRaw || null,
    kind,
    currency,
    channel,
    label: text(d["label"], 80) || channel.replace(/_/g, " "),
    address,
    memo: text(d["memo"], 120) || null,
    instructions: text(d["instructions"], 400) || null,
    active: d["active"] !== false,
    sortOrder: Number.isFinite(sortRaw) ? Math.trunc(sortRaw) : 0,
  };
}

export function parseDestinationId(raw: unknown): string {
  const id = text((raw as Record<string, unknown>)?.["id"], 60);
  if (!id) throw new Error("Missing destination.");
  return id;
}
