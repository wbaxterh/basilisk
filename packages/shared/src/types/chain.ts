/**
 * Core Cardano chain types — blocks, transactions, UTxOs.
 * These represent the raw on-chain data flowing through the ingestion pipeline.
 */

/** A Cardano block header with the fields we care about. */
export interface Block {
  /** Block hash (hex, 64 chars). */
  hash: string;
  /** Slot number (absolute). */
  slot: number;
  /** Block height / block number. */
  height: number;
  /** Unix timestamp (seconds). */
  timestamp: number;
  /** Number of transactions in this block. */
  txCount: number;
  /** Epoch number. */
  epoch: number;
  /** Total fees collected in this block (lovelace). */
  fees: string;
}

/** A Cardano transaction. */
export interface Transaction {
  /** Transaction hash (hex, 64 chars). */
  hash: string;
  /** Block hash this tx belongs to. */
  blockHash: string;
  /** Block height. */
  blockHeight: number;
  /** Slot number. */
  slot: number;
  /** Index of this tx within the block. */
  blockIndex: number;
  /** Unix timestamp (from the block). */
  timestamp: number;
  /** Total fees paid (lovelace). */
  fees: string;
  /** Inputs consumed. */
  inputs: TxInput[];
  /** Outputs produced. */
  outputs: TxOutput[];
  /** Metadata (JSON), if any. */
  metadata?: Record<string, unknown>;
}

/** A transaction input (reference to a previous UTxO). */
export interface TxInput {
  /** Transaction hash of the UTxO being spent. */
  txHash: string;
  /** Output index within that transaction. */
  outputIndex: number;
  /** Address that held this UTxO (resolved). */
  address?: string;
  /** Value in lovelace. */
  amount?: string;
  /** Native assets attached. */
  assets?: Asset[];
}

/** A transaction output (a new UTxO). */
export interface TxOutput {
  /** Address receiving this output. */
  address: string;
  /** Output index within this transaction. */
  index: number;
  /** Value in lovelace. */
  amount: string;
  /** Native assets attached. */
  assets?: Asset[];
  /** Datum hash, if any. */
  datumHash?: string;
  /** Inline datum (CBOR hex), if any. */
  inlineDatum?: string;
  /** Reference script hash, if any. */
  referenceScriptHash?: string;
}

/** A native asset (token) quantity. */
export interface Asset {
  /** Policy ID (hex, 56 chars). */
  policyId: string;
  /** Asset name (hex-encoded). */
  assetName: string;
  /** Quantity (big integer as string). */
  quantity: string;
}

/** Concatenation of policyId + assetName — the unique token identifier on Cardano. */
export type AssetUnit = string;

/** Helper to build an AssetUnit from policy + name. */
export function toAssetUnit(policyId: string, assetName: string): AssetUnit {
  return `${policyId}${assetName}`;
}

/** Helper to split an AssetUnit back into policy + name. */
export function fromAssetUnit(unit: AssetUnit): { policyId: string; assetName: string } {
  return {
    policyId: unit.slice(0, 56),
    assetName: unit.slice(56),
  };
}
