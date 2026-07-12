import { NextRequest, NextResponse } from "next/server";

import { ApiError } from "@/lib/dex-data";
import {
  getOhlcv,
  getTokenPools,
  type GeckoCurrency,
  type GeckoTimeframe,
} from "@/lib/gecko-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEFRAMES = new Set<string>(["1m", "5m", "15m", "1h", "4h", "12h", "1d", "1w"]);
const QUOTES = new Set<string>(["usd", "ada"]);
const POOL_RE = /^(cardano_)?[0-9a-f]{40,160}$/;

/** CDN s-maxage per timeframe (seconds); swr is always 2×. */
const EDGE_TTL: Record<string, number> = {
  "1m": 30,
  "5m": 30,
  "15m": 60,
  "1h": 120,
  "4h": 120,
  "12h": 120,
  "1d": 600,
  "1w": 600,
};

/**
 * OHLCV candles for a token's pool via GeckoTerminal (the only free source
 * with Minswap coverage). Defaults to the token's deepest GT pool; pass
 * ?pool=<address hex> to chart a specific one. `quote=usd` (default) returns
 * USD candles; `quote=ada` returns candles in the pool's quote token (ADA).
 * `poolChoices` lists the top pools so the UI can offer a selector without
 * an extra round trip.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ asset: string }> }
) {
  const { asset } = await params;
  const unit = decodeURIComponent(asset).toLowerCase();
  const tf = req.nextUrl.searchParams.get("tf") ?? "1h";
  const quoteParam = (req.nextUrl.searchParams.get("quote") ?? "usd").toLowerCase();
  const poolParam = req.nextUrl.searchParams.get("pool");
  const limitParam = req.nextUrl.searchParams.get("limit");

  try {
    if (!/^[0-9a-f]{56,120}$/.test(unit)) {
      throw new ApiError(400, "Invalid asset unit", "Expected hex policyId + assetNameHex (56-120 hex chars).");
    }
    if (!TIMEFRAMES.has(tf)) {
      throw new ApiError(400, `Unsupported timeframe "${tf}"`, "Use tf=1m, 5m, 15m, 1h, 4h, 12h, 1d, or 1w.");
    }
    if (!QUOTES.has(quoteParam)) {
      throw new ApiError(400, `Unsupported quote "${quoteParam}"`, "Use quote=usd or quote=ada.");
    }
    if (poolParam && !POOL_RE.test(poolParam.toLowerCase())) {
      throw new ApiError(400, "Invalid pool address", "Pass the pool address hex from the token's pairs list.");
    }
    // limit only slices the response — it is NOT part of the upstream fetch
    // or cache key, so it can't be used to mint distinct GT calls.
    const limit = limitParam ? parseInt(limitParam, 10) : 300;
    if (!Number.isFinite(limit) || limit < 1 || limit > 1000) {
      throw new ApiError(400, "Invalid limit", "limit must be 1-1000.");
    }

    // Resolve which pool to chart: explicit ?pool= must belong to this
    // token's GT pool list (otherwise any client could burn our ~10 req/min
    // GeckoTerminal budget on arbitrary pool addresses).
    const pools = await getTokenPools(unit).catch((e) => {
      throw new ApiError(502, "GeckoTerminal pools lookup failed", e instanceof Error ? e.message : undefined);
    });
    const requested = poolParam?.toLowerCase().replace(/^cardano_/, "");
    if (requested && !pools.some((p) => p.address === requested)) {
      throw new ApiError(404, "Pool not found for this asset", "Pass a pool address from this token's pairs list.");
    }
    const pool = requested ? pools.find((p) => p.address === requested)! : pools[0] ?? null;
    const poolAddress = pool?.address;
    if (!poolAddress) {
      return NextResponse.json(
        {
          error: "No chartable pool found",
          hint: "GeckoTerminal has no Cardano pools for this asset. Charts read the top pool's candles, so tokens without a GT-indexed (Minswap) pool have no chart yet.",
        },
        { status: 404 }
      );
    }

    // getOhlcv always fetches limit=1000 upstream (single cache key per
    // pool+tf+currency); the client limit only trims the tail we return.
    const currency: GeckoCurrency = quoteParam === "ada" ? "token" : "usd";
    const ohlcv = await getOhlcv(poolAddress, tf as GeckoTimeframe, limit, currency);
    if (ohlcv.candles.length === 0) {
      return NextResponse.json(
        {
          error: "No candles for this pool/timeframe",
          hint: "The pool exists but GeckoTerminal returned no OHLCV rows. Try a coarser timeframe (tf=1d).",
        },
        { status: 404 }
      );
    }

    const sMaxage = EDGE_TTL[tf] ?? 120;
    return NextResponse.json(
      {
        asset: unit,
        pool: {
          address: poolAddress,
          dexId: pool?.dexId ?? "minswap",
          name: pool?.name ?? ohlcv.poolLabel ?? poolAddress,
        },
        // Top pools by reserve, so the UI can render a selector for free.
        poolChoices: pools.slice(0, 6).map((p) => ({
          address: p.address,
          dexId: p.dexId,
          name: p.name,
          reserveUsd: p.reserveUsd,
        })),
        tf,
        quote: ohlcv.quote, // "USD" | "ADA" per the quote param
        candles: ohlcv.candles,
        coverage: "Chart: top pool via GeckoTerminal (includes Minswap)",
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${sMaxage}, stale-while-revalidate=${sMaxage * 2}`,
        },
      }
    );
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message, hint: e.hint }, { status: e.status });
    }
    return NextResponse.json(
      {
        error: "OHLCV temporarily unavailable",
        hint: e instanceof Error ? e.message : "Upstream request failed.",
      },
      { status: 502 }
    );
  }
}
