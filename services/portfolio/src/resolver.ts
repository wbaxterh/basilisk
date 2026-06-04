/**
 * Holdings resolver — fetches UTxOs for a wallet and computes holdings.
 *
 * For each tracked wallet:
 * 1. Get all addresses associated with the stake address.
 * 2. Fetch UTxOs for each address.
 * 3. Aggregate asset quantities.
 * 4. Look up current prices.
 * 5. Persist holdings + snapshot.
 */

import type { ChainDataProvider } from "@basilisk/chain-data";
import type { Logger } from "@basilisk/shared";
import { toAssetUnit } from "@basilisk/shared";
import {
  type Sql,
  upsertHolding,
  clearHoldings,
  insertSnapshot,
  getLatestPrice,
} from "./db.js";

interface HoldingEntry {
  asset: string;
  quantity: bigint;
  valueAda: number;
}

/**
 * Resolve holdings for a single wallet.
 */
export async function resolveWalletHoldings(
  provider: ChainDataProvider,
  sql: Sql,
  walletId: string,
  stakeAddress: string,
  log: Logger,
): Promise<void> {
  log.info("resolving holdings", { walletId, stakeAddress: stakeAddress.slice(0, 20) + "..." });

  // 1. Get all addresses for this stake address.
  let addresses: string[];
  try {
    addresses = await provider.getStakeAddresses(stakeAddress);
  } catch (err) {
    log.warn("failed to get addresses for stake address", {
      stakeAddress: stakeAddress.slice(0, 20) + "...",
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (addresses.length === 0) {
    log.debug("no addresses found for stake address", { stakeAddress: stakeAddress.slice(0, 20) + "..." });
    return;
  }

  // 2. Fetch UTxOs for all addresses and aggregate balances.
  const balances = new Map<string, bigint>(); // asset → total quantity

  for (const address of addresses) {
    try {
      const utxos = await provider.getAddressUtxos(address);

      for (const utxo of utxos) {
        // ADA balance.
        const lovelace = balances.get("lovelace") ?? 0n;
        balances.set("lovelace", lovelace + BigInt(utxo.amount));

        // Native assets.
        for (const asset of utxo.assets) {
          const unit = toAssetUnit(asset.policyId, asset.assetName);
          const current = balances.get(unit) ?? 0n;
          balances.set(unit, current + BigInt(asset.quantity));
        }
      }
    } catch (err) {
      log.warn("failed to fetch UTxOs for address", {
        address: address.slice(0, 20) + "...",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 3. Compute values using latest prices.
  const holdings: HoldingEntry[] = [];
  let totalValueAda = 0;

  for (const [asset, quantity] of balances) {
    let valueAda = 0;

    if (asset === "lovelace") {
      valueAda = Number(quantity) / 1_000_000; // lovelace → ADA
    } else {
      const price = await getLatestPrice(sql, asset);
      if (price) {
        valueAda = Number(quantity) * parseFloat(price.priceAda);
      }
    }

    holdings.push({ asset, quantity, valueAda });
    totalValueAda += valueAda;
  }

  // 4. Persist holdings.
  await clearHoldings(sql, walletId);

  for (const h of holdings) {
    await upsertHolding(
      sql,
      walletId,
      h.asset,
      h.quantity.toString(),
      h.valueAda.toFixed(6),
      null, // USD value computed when we have ADA/USD price
    );
  }

  // 5. Create snapshot.
  const snapshotData = holdings.map((h) => ({
    asset: h.asset,
    quantity: h.quantity.toString(),
    valueAda: h.valueAda.toFixed(6),
  }));

  await insertSnapshot(sql, walletId, totalValueAda.toFixed(6), null, snapshotData);

  log.info("holdings resolved", {
    walletId,
    assetsCount: holdings.length,
    totalValueAda: totalValueAda.toFixed(2),
  });
}
