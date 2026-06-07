/**
 * Wallet profiler endpoints — look up any address's holdings, value, and activity.
 */

import type { FastifyInstance } from "fastify";
import type { Sql } from "../db.js";
import type { ChainDataProvider } from "@basilisk/chain-data";
import { toAssetUnit } from "@basilisk/shared";

export async function profilerRoutes(
  app: FastifyInstance,
  sql: Sql,
  provider: ChainDataProvider,
): Promise<void> {
  /** GET /api/profiler/:address — profile any wallet. */
  app.get("/api/profiler/:address", async (req, reply) => {
    const { address } = req.params as { address: string };
    const input = address.trim();

    if (!input) {
      reply.status(400);
      return { error: { code: "MISSING_ADDRESS", message: "Address is required" } };
    }

    let stakeAddress: string | null = null;
    let addresses: string[] = [];

    if (input.startsWith("stake1")) {
      stakeAddress = input;
      try {
        addresses = await provider.getStakeAddresses(input);
      } catch {
        addresses = [];
      }
    } else if (input.startsWith("addr1")) {
      addresses = [input];
    } else {
      reply.status(400);
      return {
        error: {
          code: "INVALID_ADDRESS",
          message: "Provide a stake address (stake1...) or payment address (addr1...)",
        },
      };
    }

    if (addresses.length === 0) {
      return {
        data: { address: input, stakeAddress, totalValueAda: "0", holdings: [], activity: [] },
      };
    }

    // Fetch UTxOs and aggregate balances.
    const balances = new Map<string, bigint>();

    for (const addr of addresses) {
      try {
        const utxos = await provider.getAddressUtxos(addr);
        for (const utxo of utxos) {
          const lovelace = balances.get("lovelace") ?? 0n;
          balances.set("lovelace", lovelace + BigInt(utxo.amount));

          for (const asset of utxo.assets) {
            const unit = toAssetUnit(asset.policyId, asset.assetName);
            const current = balances.get(unit) ?? 0n;
            balances.set(unit, current + BigInt(asset.quantity));
          }
        }
      } catch {
        // Skip addresses that fail.
      }
    }

    // Look up prices and token metadata.
    const holdings: Array<{
      asset: string;
      quantity: string;
      valueAda: string;
      ticker: string | null;
      name: string | null;
      decimals: number;
    }> = [];
    let totalValueAda = 0;

    for (const [asset, quantity] of balances) {
      let valueAda = 0;

      if (asset === "lovelace") {
        valueAda = Number(quantity) / 1_000_000;
      } else {
        const priceRows = await sql`
          SELECT price_ada FROM prices WHERE asset = ${asset} ORDER BY timestamp DESC LIMIT 1
        `;
        if (priceRows.length > 0) {
          valueAda = Number(quantity) * parseFloat(priceRows[0]!.price_ada as string);
        }
      }

      let ticker: string | null = null;
      let name: string | null = null;
      let decimals = 0;

      if (asset === "lovelace") {
        ticker = "ADA";
        name = "Cardano";
        decimals = 6;
      } else {
        const metaRows = await sql`
          SELECT ticker, name, decimals FROM token_metadata WHERE asset = ${asset} LIMIT 1
        `;
        if (metaRows.length > 0) {
          ticker = metaRows[0]!.ticker as string | null;
          name = metaRows[0]!.name as string | null;
          decimals = (metaRows[0]!.decimals as number) ?? 0;
        }
      }

      holdings.push({ asset, quantity: quantity.toString(), valueAda: valueAda.toFixed(6), ticker, name, decimals });
      totalValueAda += valueAda;
    }

    holdings.sort((a, b) => parseFloat(b.valueAda) - parseFloat(a.valueAda));

    // Get recent DEX activity.
    const activityRows = await sql`
      SELECT tx_hash, dex, asset_in, amount_in, asset_out, amount_out,
             EXTRACT(EPOCH FROM timestamp)::int AS timestamp
      FROM dex_swaps
      WHERE sender_address = ANY(${addresses})
      ORDER BY timestamp DESC
      LIMIT 50
    `;

    return {
      data: {
        address: input,
        stakeAddress,
        totalValueAda: totalValueAda.toFixed(6),
        holdings,
        activity: activityRows.map((r) => ({
          txHash: r.tx_hash,
          dex: r.dex,
          assetIn: r.asset_in,
          amountIn: r.amount_in,
          assetOut: r.asset_out,
          amountOut: r.amount_out,
          timestamp: r.timestamp,
        })),
      },
    };
  });
}
