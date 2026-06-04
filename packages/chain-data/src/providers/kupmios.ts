/**
 * Kupmios (Ogmios + Kupo) implementation of ChainDataProvider.
 *
 * - Ogmios: WebSocket JSON-RPC for chain-sync, ledger queries, and tip.
 * - Kupo: HTTP REST for indexed UTxO queries by address/pattern.
 *
 * See ADR-001 for the architectural decision.
 */

import {
  createConnectionObject,
  createInteractionContext,
  createLedgerStateQueryClient,
  type InteractionContext,
  type ConnectionConfig,
} from "@cardano-ogmios/client";
import type { Block, Transaction, Asset } from "@basilisk/shared";
import type { ChainDataProvider, ProviderUtxo, QueryOptions } from "../provider.js";

export interface KupmiosConfig {
  /** Ogmios host (default: localhost). */
  ogmiosHost?: string;
  /** Ogmios port (default: 1337). */
  ogmiosPort?: number;
  /** Ogmios TLS (default: false). */
  ogmiosTls?: boolean;
  /** Kupo base URL (e.g. http://localhost:1442). */
  kupoUrl: string;
}

/** A Kupo UTxO response item. */
interface KupoUtxo {
  transaction_id: string;
  output_index: number;
  address: string;
  value: {
    coins: number;
    assets?: Record<string, number>;
  };
  datum_hash?: string | null;
  datum_type?: string | null;
  script_hash?: string | null;
  created_at: { slot_no: number; header_hash: string };
}

export class KupmiosProvider implements ChainDataProvider {
  readonly name = "kupmios";
  private readonly ogmiosConfig: ConnectionConfig;
  private readonly kupoUrl: string;

  constructor(config: KupmiosConfig) {
    this.ogmiosConfig = {
      host: config.ogmiosHost ?? "localhost",
      port: config.ogmiosPort ?? 1337,
      tls: config.ogmiosTls ?? false,
    };
    this.kupoUrl = config.kupoUrl.replace(/\/$/, "");
  }

  async getLatestBlock(): Promise<Block> {
    const tip = await this.queryLedger(async (client) => {
      return client.networkTip();
    });
    return this.tipToBlock(tip);
  }

  async getBlock(hashOrHeight: string | number): Promise<Block> {
    // Ogmios doesn't have a direct "get block by hash/height" — use ledger tip
    // for latest, or fall through. For historical blocks, Kupo metadata can help.
    // For now, if it's a number, treat it as a slot query via Kupo.
    if (typeof hashOrHeight === "number") {
      // Use Kupo to find a UTxO at this slot to derive block info.
      // This is a simplification — full block data requires chain-sync replay.
      const tip = await this.queryLedger(async (client) => client.networkTip());
      return this.tipToBlock(tip);
    }

    // For hash lookups, return tip as approximation.
    // Full implementation would use chain-sync history.
    const tip = await this.queryLedger(async (client) => client.networkTip());
    return this.tipToBlock(tip);
  }

  async getBlockTransactions(
    hashOrHeight: string | number,
    _opts?: QueryOptions,
  ): Promise<string[]> {
    // Kupo tracks UTxOs, not full transaction lists per block.
    // For block tx enumeration, chain-sync is needed.
    // Return empty — the streaming chain-sync approach (#51) will replace this.
    return [];
  }

  async getTransaction(_hash: string): Promise<Transaction> {
    // Ogmios doesn't index historical transactions by hash.
    // This requires either chain-sync replay or Kupo pattern matching.
    // Placeholder — will be replaced by streaming ingestion (#51).
    throw new Error("KupmiosProvider.getTransaction requires chain-sync streaming (see #51)");
  }

  async getAddressUtxos(address: string, _opts?: QueryOptions): Promise<ProviderUtxo[]> {
    const response = await fetch(`${this.kupoUrl}/matches/${address}?unspent`);
    if (!response.ok) {
      throw new Error(`Kupo error: ${response.status} ${response.statusText}`);
    }

    const utxos = (await response.json()) as KupoUtxo[];
    return utxos.map((u) => this.mapKupoUtxo(u));
  }

  async getStakeAddresses(stakeAddress: string, _opts?: QueryOptions): Promise<string[]> {
    // Kupo can match by stake address pattern: */<stake_key_hash>
    // Extract the stake key from the bech32 address and query Kupo.
    // For now, query Kupo for UTxOs matching the stake credential.
    const response = await fetch(`${this.kupoUrl}/matches/${stakeAddress}/*?unspent`);
    if (!response.ok) {
      // Fallback: return the stake address itself.
      return [stakeAddress];
    }

    const utxos = (await response.json()) as KupoUtxo[];
    const addresses = new Set(utxos.map((u) => u.address));
    return [...addresses];
  }

  async getTip(): Promise<{ slot: number; hash: string; height: number }> {
    const tip = await this.queryLedger(async (client) => client.networkTip());

    if (tip === "origin") {
      return { slot: 0, hash: "", height: 0 };
    }

    // networkTip returns { slot, id } — we need height from networkBlockHeight.
    const height = await this.queryLedger(async (client) => client.networkBlockHeight());

    return {
      slot: (tip as { slot: number }).slot,
      hash: (tip as { id: string }).id,
      height: typeof height === "number" ? height : 0,
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Check Ogmios.
      const connection = createConnectionObject(this.ogmiosConfig);
      const res = await fetch(`${connection.address.http}/health`);
      if (!res.ok) return false;

      // Check Kupo.
      const kupoRes = await fetch(`${this.kupoUrl}/health`);
      if (!kupoRes.ok) return false;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute a one-shot ledger state query via Ogmios.
   */
  private async queryLedger<T>(
    fn: (client: Awaited<ReturnType<typeof createLedgerStateQueryClient>>) => Promise<T>,
  ): Promise<T> {
    const context = await createInteractionContext(
      (err) => { throw err; },
      () => {},
      { connection: this.ogmiosConfig },
    );

    try {
      const client = await createLedgerStateQueryClient(context);
      const result = await fn(client);
      await client.shutdown();
      return result;
    } finally {
      (context.socket as unknown as { close(): void }).close();
    }
  }

  private tipToBlock(tip: unknown): Block {
    if (tip === "origin") {
      return { hash: "", slot: 0, height: 0, timestamp: 0, txCount: 0, epoch: 0, fees: "0" };
    }

    const t = tip as { slot: number; id: string };
    return {
      hash: t.id,
      slot: t.slot,
      height: 0, // Tip doesn't include height directly.
      timestamp: Math.floor(Date.now() / 1000),
      txCount: 0,
      epoch: 0,
      fees: "0",
    };
  }

  private mapKupoUtxo(u: KupoUtxo): ProviderUtxo {
    const assets: Asset[] = [];
    if (u.value.assets) {
      for (const [unit, qty] of Object.entries(u.value.assets)) {
        // Kupo format: "policyId.assetName"
        const dotIndex = unit.indexOf(".");
        if (dotIndex > 0) {
          assets.push({
            policyId: unit.slice(0, dotIndex),
            assetName: unit.slice(dotIndex + 1),
            quantity: String(qty),
          });
        }
      }
    }

    return {
      txHash: u.transaction_id,
      outputIndex: u.output_index,
      address: u.address,
      amount: String(u.value.coins),
      assets,
      datumHash: u.datum_hash ?? undefined,
    };
  }
}
