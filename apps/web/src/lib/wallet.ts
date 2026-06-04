/**
 * CIP-30 Cardano wallet connector.
 *
 * CIP-30 defines a standard interface for dApps to connect to Cardano wallets.
 * Supported wallets: Nami, Eternl, Flint, Lace, Typhon, GeroWallet, etc.
 *
 * The wallet API is injected into `window.cardano` by browser extensions.
 */

/** Known wallet identifiers from window.cardano */
export interface WalletInfo {
  id: string;
  name: string;
  icon: string;
  apiVersion: string;
}

/** Connected wallet state. */
export interface ConnectedWallet {
  info: WalletInfo;
  api: CardanoWalletApi;
  stakeAddress: string;
  changeAddress: string;
  balance: string; // lovelace
}

/** CIP-30 wallet API (subset we use). */
export interface CardanoWalletApi {
  getBalance(): Promise<string>;
  getChangeAddress(): Promise<string>;
  getRewardAddresses(): Promise<string[]>;
  getUtxos(): Promise<string[] | null>;
  getUsedAddresses(): Promise<string[]>;
  getNetworkId(): Promise<number>;
}

/** CIP-30 initial API on window.cardano[walletId]. */
interface CIP30WalletEntry {
  name: string;
  icon: string;
  apiVersion: string;
  enable(): Promise<CardanoWalletApi>;
  isEnabled(): Promise<boolean>;
}

/** Detect available CIP-30 wallets in the browser. */
export function detectWallets(): WalletInfo[] {
  if (typeof window === "undefined") return [];

  const cardano = (window as unknown as Record<string, unknown>).cardano as
    | Record<string, CIP30WalletEntry>
    | undefined;

  if (!cardano) return [];

  const knownWallets = ["nami", "eternl", "flint", "lace", "typhon", "gerowallet", "begin", "vespr"];
  const found: WalletInfo[] = [];

  for (const id of knownWallets) {
    const entry = cardano[id];
    if (entry && typeof entry.enable === "function") {
      found.push({
        id,
        name: entry.name,
        icon: entry.icon,
        apiVersion: entry.apiVersion,
      });
    }
  }

  return found;
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
