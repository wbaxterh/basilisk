/**
 * ChainDataProvider — abstract interface for Cardano chain data access.
 * Implemented by Blockfrost (now) and Demeter/Ogmios (later).
 * The ingestion service programs against this interface, not a specific backend.
 */

import type { Block, Transaction, Asset } from "@basilisk/shared";

/** Options for paginated queries. */
export interface QueryOptions {
  page?: number;
  count?: number;
  order?: "asc" | "desc";
}

/** UTxO as returned by the provider. */
export interface ProviderUtxo {
  txHash: string;
  outputIndex: number;
  address: string;
  amount: string;
  assets: Asset[];
  datumHash?: string;
  inlineDatum?: string;
}

/**
 * Abstract chain data provider.
 * Each method maps to a specific data need from the ingestion/portfolio services.
 */
export interface ChainDataProvider {
  /** Provider name for logging. */
  readonly name: string;

  /** Get the latest block on chain. */
  getLatestBlock(): Promise<Block>;

  /** Get a block by hash or height. */
  getBlock(hashOrHeight: string | number): Promise<Block>;

  /** Get transactions in a block. */
  getBlockTransactions(hashOrHeight: string | number, opts?: QueryOptions): Promise<string[]>;

  /** Get full transaction details by hash. */
  getTransaction(hash: string): Promise<Transaction>;

  /** Get UTxOs at an address. */
  getAddressUtxos(address: string, opts?: QueryOptions): Promise<ProviderUtxo[]>;

  /** Get all addresses associated with a stake address. */
  getStakeAddresses(stakeAddress: string, opts?: QueryOptions): Promise<string[]>;

  /** Get current tip (latest slot). */
  getTip(): Promise<{ slot: number; hash: string; height: number }>;

  /** Health check — is the provider reachable and synced? */
  isHealthy(): Promise<boolean>;

  /** Get addresses holding a specific asset, sorted by quantity descending. */
  getAssetAddresses(
    asset: string,
    opts?: QueryOptions,
  ): Promise<Array<{ address: string; quantity: string }>>;
}
