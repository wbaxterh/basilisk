/**
 * FailoverProvider — wraps a primary and fallback ChainDataProvider.
 *
 * All methods try the primary first. On error, falls back to the secondary.
 * Periodic health checks switch back to primary when it recovers.
 *
 * See ADR-001 and issue #50.
 */

import type { Block, Transaction } from "@basilisk/shared";
import type { ChainDataProvider, ProviderUtxo, QueryOptions } from "../provider.js";

export interface FailoverConfig {
  /** How often to check primary health (ms). Default: 30000. */
  healthCheckIntervalMs?: number;
}

export class FailoverProvider implements ChainDataProvider {
  private readonly primary: ChainDataProvider;
  private readonly fallback: ChainDataProvider;
  private usingPrimary = true;
  private healthTimer: ReturnType<typeof setInterval> | null = null;

  get name(): string {
    const active = this.usingPrimary ? this.primary : this.fallback;
    return `failover(${active.name})`;
  }

  constructor(
    primary: ChainDataProvider,
    fallback: ChainDataProvider,
    config?: FailoverConfig,
  ) {
    this.primary = primary;
    this.fallback = fallback;

    const interval = config?.healthCheckIntervalMs ?? 30_000;
    this.healthTimer = setInterval(() => this.checkPrimaryHealth(), interval);
  }

  async getLatestBlock(): Promise<Block> {
    return this.withFailover(() => this.active().getLatestBlock());
  }

  async getBlock(hashOrHeight: string | number): Promise<Block> {
    return this.withFailover(() => this.active().getBlock(hashOrHeight));
  }

  async getBlockTransactions(hashOrHeight: string | number, opts?: QueryOptions): Promise<string[]> {
    return this.withFailover(() => this.active().getBlockTransactions(hashOrHeight, opts));
  }

  async getTransaction(hash: string): Promise<Transaction> {
    return this.withFailover(() => this.active().getTransaction(hash));
  }

  async getAddressUtxos(address: string, opts?: QueryOptions): Promise<ProviderUtxo[]> {
    return this.withFailover(() => this.active().getAddressUtxos(address, opts));
  }

  async getStakeAddresses(stakeAddress: string, opts?: QueryOptions): Promise<string[]> {
    return this.withFailover(() => this.active().getStakeAddresses(stakeAddress, opts));
  }

  async getTip(): Promise<{ slot: number; hash: string; height: number }> {
    return this.withFailover(() => this.active().getTip());
  }

  async isHealthy(): Promise<boolean> {
    const primaryHealthy = await this.primary.isHealthy();
    if (primaryHealthy) return true;
    return this.fallback.isHealthy();
  }

  /** Stop the health check timer. */
  destroy(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  private active(): ChainDataProvider {
    return this.usingPrimary ? this.primary : this.fallback;
  }

  private async withFailover<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (this.usingPrimary) {
        console.warn(
          `[failover] primary provider (${this.primary.name}) failed, switching to fallback (${this.fallback.name}):`,
          err instanceof Error ? err.message : err,
        );
        this.usingPrimary = false;
        // Retry with fallback.
        return fn();
      }
      // Already on fallback — let the error propagate.
      throw err;
    }
  }

  private async checkPrimaryHealth(): Promise<void> {
    if (this.usingPrimary) return; // Already on primary.

    try {
      const healthy = await this.primary.isHealthy();
      if (healthy) {
        console.warn(
          `[failover] primary provider (${this.primary.name}) recovered, switching back from fallback (${this.fallback.name})`,
        );
        this.usingPrimary = true;
      }
    } catch {
      // Primary still down — stay on fallback.
    }
  }
}
