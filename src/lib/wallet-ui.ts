// Presentation helpers for the wallet screen. Pure client-safe utilities —
// every financial value still comes from the server.

export const CRYPTO_ORDER = ["USDT", "USDC", "BTC", "ETH"] as const;

export const CRYPTO_META: Record<string, { name: string; tint: string }> = {
  USDT: { name: "Tether", tint: "text-primary" },
  USDC: { name: "USD Coin", tint: "text-sky-400" },
  BTC: { name: "Bitcoin", tint: "text-amber-400" },
  ETH: { name: "Ethereum", tint: "text-indigo-300" },
};

/** Networks are labelled for humans but keep their canonical server value.
 * Display labels live in the wallet i18n pack (wallet.network.*); this map
 * only resolves the translation key for a given network code. */
export const NETWORK_LABEL_KEY: Record<string, string> = {
  TRON: "wallet.network.tron",
  ETHEREUM: "wallet.network.ethereum",
  BSC: "wallet.network.bsc",
  BITCOIN: "wallet.network.bitcoin",
};

export function networkLabelKey(network: string): string {
  return NETWORK_LABEL_KEY[network] ?? network;
}

/** Stablecoins track the dollar 1:1; anything else needs a live rate we do not fake. */
export function fiatEquivalent(currency: string, amount: number): number | null {
  return currency === "USDT" || currency === "USDC" || currency === "USD" ? amount : null;
}

const ADDRESS_RULES: Record<string, RegExp> = {
  TRON: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  ETHEREUM: /^0x[a-fA-F0-9]{40}$/,
  BSC: /^0x[a-fA-F0-9]{40}$/,
  BITCOIN: /^(bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
};

export function isValidAddress(network: string, address: string): boolean {
  const rule = ADDRESS_RULES[network];
  if (!rule) return address.trim().length >= 12;
  return rule.test(address.trim());
}

export function explorerUrl(network: string, hash: string): string | null {
  if (!hash) return null;
  switch (network) {
    case "TRON":
      return `https://tronscan.org/#/transaction/${hash}`;
    case "ETHEREUM":
      return `https://etherscan.io/tx/${hash}`;
    case "BSC":
      return `https://bscscan.com/tx/${hash}`;
    case "BITCOIN":
      return `https://blockstream.info/tx/${hash}`;
    default:
      return null;
  }
}

export function shortHash(value: string, lead = 6, tail = 6): string {
  if (value.length <= lead + tail + 3) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

export function statusTone(status: string): string {
  const s = status.toUpperCase();
  if (["CONFIRMED", "APPROVED", "PAID", "COMPLETED", "CREDITED"].includes(s)) {
    return "border-primary/50 bg-primary/10 text-primary";
  }
  if (["FAILED", "REJECTED", "CANCELLED", "EXPIRED"].includes(s)) {
    return "border-destructive/50 bg-destructive/10 text-destructive";
  }
  if (["CONFIRMING", "PROCESSING", "PENDING", "REQUESTED", "RISK_REVIEW", "REVIEW"].includes(s)) {
    return "border-amber-500/50 bg-amber-500/10 text-amber-400";
  }
  return "border-border bg-muted/30 text-muted-foreground";
}

export function formatAmount(value: string | number | null | undefined, decimals = 8): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}