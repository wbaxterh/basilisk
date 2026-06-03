/**
 * Blockfrost implementation of ChainDataProvider.
 * Uses @blockfrost/blockfrost-js SDK. Free tier: 50k requests/day.
 */

import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import type { Block, Transaction, Asset } from "@basilisk/shared";
import type { ChainDataProvider, ProviderUtxo, QueryOptions } from "../provider.js";

export interface BlockfrostConfig {
  projectId: string;
  network?: "mainnet" | "preprod" | "preview";
}

export class BlockfrostProvider implements ChainDataProvider {
  readonly name = "blockfrost";
  private readonly api: BlockFrostAPI;

  constructor(config: BlockfrostConfig) {
    this.api = new BlockFrostAPI({
      projectId: config.projectId,
      network: config.network ?? "mainnet",
    });
  }

  async getLatestBlock(): Promise<Block> {
    const raw = await this.api.blocksLatest();
    return this.mapBlock(raw);
  }

  async getBlock(hashOrHeight: string | number): Promise<Block> {
    const raw = await this.api.blocks(hashOrHeight);
    return this.mapBlock(raw);
  }

  async getBlockTransactions(
    hashOrHeight: string | number,
    opts?: QueryOptions,
  ): Promise<string[]> {
    const txs = await this.api.blocksTxs(String(hashOrHeight), {
      page: opts?.page ?? 1,
      count: opts?.count ?? 100,
      order: opts?.order ?? "asc",
    });
    return txs;
  }

  async getTransaction(hash: string): Promise<Transaction> {
    const [tx, utxos] = await Promise.all([
      this.api.txs(hash),
      this.api.txsUtxos(hash),
    ]);

    return {
      hash: tx.hash,
      blockHash: tx.block,
      blockHeight: tx.block_height,
      slot: tx.slot,
      blockIndex: tx.index,
      timestamp: tx.block_time,
      fees: tx.fees,
      inputs: utxos.inputs.map((inp) => ({
        txHash: inp.tx_hash,
        outputIndex: inp.output_index,
        address: inp.address,
        amount: inp.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0",
        assets: inp.amount
          .filter((a) => a.unit !== "lovelace")
          .map((a) => ({
            policyId: a.unit.slice(0, 56),
            assetName: a.unit.slice(56),
            quantity: a.quantity,
          })),
      })),
      outputs: utxos.outputs.map((out) => ({
        address: out.address,
        index: out.output_index,
        amount: out.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0",
        assets: out.amount
          .filter((a) => a.unit !== "lovelace")
          .map((a) => ({
            policyId: a.unit.slice(0, 56),
            assetName: a.unit.slice(56),
            quantity: a.quantity,
          })),
        datumHash: out.data_hash ?? undefined,
        inlineDatum: out.inline_datum ?? undefined,
      })),
    };
  }

  async getAddressUtxos(address: string, opts?: QueryOptions): Promise<ProviderUtxo[]> {
    const utxos = await this.api.addressesUtxos(address, {
      page: opts?.page ?? 1,
      count: opts?.count ?? 100,
      order: opts?.order ?? "asc",
    });

    return utxos.map((u) => ({
      txHash: u.tx_hash,
      outputIndex: u.output_index,
      address,
      amount: u.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0",
      assets: u.amount
        .filter((a) => a.unit !== "lovelace")
        .map(
          (a): Asset => ({
            policyId: a.unit.slice(0, 56),
            assetName: a.unit.slice(56),
            quantity: a.quantity,
          }),
        ),
      datumHash: u.data_hash ?? undefined,
      inlineDatum: u.inline_datum ?? undefined,
    }));
  }

  async getStakeAddresses(stakeAddress: string, opts?: QueryOptions): Promise<string[]> {
    const addrs = await this.api.accountsAddresses(stakeAddress, {
      page: opts?.page ?? 1,
      count: opts?.count ?? 100,
      order: opts?.order ?? "asc",
    });
    return addrs.map((a) => a.address);
  }

  async getTip(): Promise<{ slot: number; hash: string; height: number }> {
    const block = await this.api.blocksLatest();
    return {
      slot: block.slot ?? 0,
      hash: block.hash,
      height: block.height ?? 0,
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.api.health();
      return health.is_healthy;
    } catch {
      return false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapBlock(raw: Record<string, any>): Block {
    return {
      hash: raw.hash as string,
      slot: (raw.slot as number) ?? 0,
      height: (raw.height as number) ?? 0,
      timestamp: raw.time as number,
      txCount: raw.tx_count as number,
      epoch: (raw.epoch as number) ?? 0,
      fees: (raw.fees as string) ?? "0",
    };
  }
}
