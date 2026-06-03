/**
 * Portfolio types — wallet holdings, P&L, value snapshots.
 * Used by services/portfolio and the portfolio UI.
 */

import type { AssetUnit } from "./chain.js";

/** A tracked wallet. */
export interface Wallet {
  /** Internal wallet ID (UUID). */
  id: string;
  /** Bech32 stake address (for multi-address wallets) or payment address. */
  stakeAddress: string;
  /** Optional user-given label. */
  label?: string;
  /** User ID who owns this wallet (null = public lookup). */
  userId?: string;
  /** When this wallet was added. */
  createdAt: number;
}

/** A token holding within a wallet. */
export interface Holding {
  /** The token (AssetUnit), or "lovelace" for ADA. */
  asset: AssetUnit | "lovelace";
  /** Current quantity (raw units). */
  quantity: string;
  /** Current value in ADA. */
  valueAda: string;
  /** Current value in USD. */
  valueUsd?: string;
  /** Average cost basis in ADA per unit (if computable). */
  avgCostAda?: string;
  /** Unrealized P&L in ADA. */
  unrealizedPnlAda?: string;
}

/** A portfolio snapshot at a point in time. */
export interface PortfolioSnapshot {
  /** Wallet ID. */
  walletId: string;
  /** Unix timestamp. */
  timestamp: number;
  /** Total value in ADA. */
  totalValueAda: string;
  /** Total value in USD. */
  totalValueUsd?: string;
  /** Individual holdings at this point. */
  holdings: Holding[];
}

/** Realized P&L entry for a completed trade. */
export interface RealizedPnl {
  /** The token traded. */
  asset: AssetUnit;
  /** Transaction hash of the sell. */
  txHash: string;
  /** Quantity sold. */
  quantitySold: string;
  /** Proceeds in ADA. */
  proceedsAda: string;
  /** Cost basis in ADA. */
  costBasisAda: string;
  /** P&L in ADA (proceeds - costBasis). */
  pnlAda: string;
  /** Unix timestamp of the sale. */
  timestamp: number;
}
