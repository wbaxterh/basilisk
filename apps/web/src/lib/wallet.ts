/**
 * CIP-30 Cardano wallet connector.
 *
 * CIP-30 defines a standard interface for dApps to connect to Cardano wallets.
 * The wallet API is injected into `window.cardano` by browser extensions.
 *
 * Detection notes (mid-2026 landscape):
 * - VESPR injects CIP-30 compatibility shims under OTHER wallets' keys
 *   (nami, flint, …) with `.name === "VESPR"`, so naive key enumeration shows
 *   the same wallet many times. We therefore enumerate ALL window.cardano keys
 *   and dedupe by the injected `.name`, preferring each wallet's canonical key.
 * - Nami was sunset in Jan 2025 (merged into Lace as "Nami mode"); Flint was
 *   sunset by dcSpark in Aug 2024. Neither appears in CANONICAL_WALLETS.
 * - Eternl historically also injected under its old "ccvault" key — the
 *   name-dedupe collapses it, and we skip the alias key outright.
 */

/** Known wallet identifiers from window.cardano */
export interface WalletInfo {
  id: string;
  name: string;
  icon: string;
  apiVersion: string;
}

/** A wallet we recognize: canonical window.cardano key, display name, homepage. */
export interface CanonicalWallet {
  key: string;
  displayName: string;
  homepage: string;
}

/**
 * Live CIP-30 browser wallets as of mid-2026, ordered by popularity.
 * Used for picker ordering, canonical-key dedupe preference, and the
 * "no wallets installed" suggestion list (top 4).
 */
export const CANONICAL_WALLETS: CanonicalWallet[] = [
  { key: "eternl", displayName: "Eternl", homepage: "https://eternl.io" },
  { key: "lace", displayName: "Lace", homepage: "https://www.lace.io" },
  { key: "vespr", displayName: "VESPR", homepage: "https://vespr.xyz" },
  { key: "typhoncip30", displayName: "Typhon", homepage: "https://typhonwallet.io" },
  { key: "begin", displayName: "Begin", homepage: "https://begin.is" },
  { key: "yoroi", displayName: "Yoroi", homepage: "https://yoroi-wallet.com" },
  { key: "gerowallet", displayName: "GeroWallet", homepage: "https://gerowallet.io" },
  { key: "nufi", displayName: "NuFi", homepage: "https://nu.fi" },
  { key: "tokeo", displayName: "Tokeo", homepage: "https://tokeo.io" },
];

/** Keys that are aliases of another wallet's injection, never wallets themselves. */
const NON_WALLET_KEYS = new Set(["ccvault"]);

/** Match an injected `.name` (any casing, optional " Wallet" suffix) to our registry. */
export function canonicalWalletFor(name: string): CanonicalWallet | undefined {
  const norm = name.trim().toLowerCase();
  return CANONICAL_WALLETS.find(
    (w) =>
      norm === w.key ||
      norm === w.displayName.toLowerCase() ||
      norm.startsWith(`${w.displayName.toLowerCase()} `)
  );
}

/** Connected wallet state. */
export interface ConnectedWallet {
  info: WalletInfo;
  api: CardanoWalletApi;
  stakeAddress: string;
  changeAddress: string;
  balance: string; // lovelace
}

/** CIP-30 DataSignature returned by api.signData (CIP-8/COSE, hex CBOR). */
export interface DataSignature {
  signature: string; // COSE_Sign1 cbor hex
  key: string; // COSE_Key cbor hex
}

/** CIP-30 wallet API (subset we use). */
export interface CardanoWalletApi {
  getBalance(): Promise<string>;
  getChangeAddress(): Promise<string>;
  getRewardAddresses(): Promise<string[]>;
  getUtxos(): Promise<string[] | null>;
  getUsedAddresses(): Promise<string[]>;
  getNetworkId(): Promise<number>;
  signData(addressHex: string, payloadHex: string): Promise<DataSignature>;
}

/** CIP-30 initial API on window.cardano[walletId]. */
interface CIP30WalletEntry {
  name: string;
  icon: string;
  apiVersion: string;
  enable(): Promise<CardanoWalletApi>;
  isEnabled(): Promise<boolean>;
}

/**
 * Preference rank for candidates sharing the same wallet name (lower wins):
 * 0 — key is the wallet's canonical key ("vespr" for name "VESPR")
 * 1 — key equals the normalized name (unknown-but-self-named wallets)
 * 2 — anything else (e.g. VESPR's shim under "nami")
 */
function candidateRank(candidate: WalletInfo, normName: string): number {
  const canonical = canonicalWalletFor(normName);
  if (canonical && candidate.id === canonical.key) return 0;
  if (candidate.id.toLowerCase() === normName) return 1;
  return 2;
}

/**
 * Detect available CIP-30 wallets in the browser.
 *
 * Enumerates every window.cardano key (not a hardcoded list), keeps entries
 * that look like CIP-30 initial APIs (`.enable` + `.name`), then dedupes by
 * normalized name so wallets that inject compatibility shims under other
 * keys (VESPR) appear exactly once, under their own key.
 */
export function detectWallets(): WalletInfo[] {
  if (typeof window === "undefined") return [];

  const cardano = (window as unknown as Record<string, unknown>).cardano as
    | Record<string, Partial<CIP30WalletEntry> | undefined>
    | undefined;

  if (!cardano || typeof cardano !== "object") return [];

  const candidates: WalletInfo[] = [];
  for (const key of Object.keys(cardano)) {
    if (NON_WALLET_KEYS.has(key)) continue;
    let entry: Partial<CIP30WalletEntry> | undefined;
    try {
      entry = cardano[key];
    } catch {
      continue; // hostile getter — not a wallet we can use
    }
    if (!entry || typeof entry !== "object") continue;
    if (typeof entry.enable !== "function") continue;
    if (typeof entry.name !== "string" || entry.name.trim() === "") continue;

    candidates.push({
      id: key,
      name: entry.name.trim(),
      icon: typeof entry.icon === "string" ? entry.icon : "",
      apiVersion: typeof entry.apiVersion === "string" ? entry.apiVersion : "",
    });
  }

  // Dedupe: one entry per normalized name, best-ranked key wins (first seen on ties).
  const byName = new Map<string, WalletInfo>();
  for (const c of candidates) {
    const norm = c.name.toLowerCase();
    const existing = byName.get(norm);
    if (!existing || candidateRank(c, norm) < candidateRank(existing, norm)) {
      byName.set(norm, c);
    }
  }

  // Order: canonical (popularity) first, then unknown wallets alphabetically.
  const orderOf = (w: WalletInfo): number => {
    const canonical = canonicalWalletFor(w.name);
    return canonical ? CANONICAL_WALLETS.indexOf(canonical) : CANONICAL_WALLETS.length;
  };
  return [...byName.values()].sort(
    (a, b) => orderOf(a) - orderOf(b) || a.name.localeCompare(b.name)
  );
}

/** Connect to a specific wallet by ID. */
export async function connectWallet(walletId: string): Promise<ConnectedWallet> {
  const cardano = (window as unknown as Record<string, unknown>).cardano as
    | Record<string, CIP30WalletEntry>
    | undefined;

  if (!cardano || !cardano[walletId]) {
    throw new Error(`Wallet "${walletId}" not found. Is the extension installed?`);
  }

  const entry = cardano[walletId]!;
  const api = await entry.enable();

  const [balance, changeAddressHex, rewardAddressesHex] = await Promise.all([
    api.getBalance(),
    api.getChangeAddress(),
    api.getRewardAddresses(),
  ]);

  // CIP-30 returns hex-encoded CBOR. For display purposes, we pass through
  // the hex. A proper implementation would decode with @emurgo/cardano-serialization-lib.
  const stakeAddress = rewardAddressesHex[0] ?? "";
  const changeAddress = changeAddressHex;

  return {
    info: {
      id: walletId,
      name: entry.name,
      icon: entry.icon,
      apiVersion: entry.apiVersion,
    },
    api,
    stakeAddress,
    changeAddress,
    balance,
  };
}

/**
 * First reward address (hex-encoded 29-byte address) from CIP-30.
 * The server derives the bech32 stake1 address from this.
 */
export async function getRewardAddressHex(api: CardanoWalletApi): Promise<string> {
  const rewardAddresses = await api.getRewardAddresses();
  const rewardAddressHex = rewardAddresses[0];
  if (!rewardAddressHex) {
    throw new Error("Wallet returned no reward (stake) address.");
  }
  return rewardAddressHex;
}

/** Signed payload bundle ready to POST to /api/v1/community endpoints. */
export interface SignedCommunityPayload {
  payloadJson: string;
  signature: string; // COSE_Sign1 cbor hex
  key: string; // COSE_Key cbor hex
  rewardAddressHex: string;
}

function utf8ToHex(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Sign a community payload (boost/comment) with the wallet's reward address
 * via CIP-30 signData. The exact JSON string that was signed is returned so
 * the server can verify byte-for-byte.
 */
export async function signCommunityPayload(
  api: CardanoWalletApi,
  payloadObj: object
): Promise<SignedCommunityPayload> {
  const payloadJson = JSON.stringify(payloadObj);
  const rewardAddressHex = await getRewardAddressHex(api);
  const { signature, key } = await api.signData(rewardAddressHex, utf8ToHex(payloadJson));
  return { payloadJson, signature, key, rewardAddressHex };
}

/** Format lovelace balance to ADA with 2 decimal places. */
export function lovelaceToAda(lovelace: string): string {
  // CIP-30 returns balance as CBOR hex. For a simple MVP, we try to parse
  // it as a number. A real implementation needs CBOR decoding.
  try {
    const num = parseInt(lovelace, 16);
    if (Number.isNaN(num)) return "—";
    return (num / 1_000_000).toFixed(2);
  } catch {
    return "—";
  }
}
