import { NextRequest, NextResponse } from "next/server";

import { ApiError } from "@/lib/dex-data";
import { getOhlcv, getTokenPools, type GeckoTimeframe } from "@/lib/gecko-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEFRAMES = new Set<string>(["15m", "1h", "4h", "1d"]);
const POOL_RE = /^(cardano_)?[0-9a-f]{40,160}$/;

/**
 * OHLCV candles for a token's pool via GeckoTerminal (the only free source
 * with Minswap coverage). Defaults to the token's deepest GT pool; pass
 * ?pool=<address hex> to chart a specific one. Candles are USD-denominated.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ asset: string }> }
) {
  const { asset } = await params;
  const unit = decodeURIComponent(asset).toLowerCase();
  const tf = req.nextUrl.searchParams.get("tf") ?? "1h";
  const poolParam = req.nextUrl.searchParams.get("pool");
  const limitParam = req.nextUrl.searchParams.get("limit");

  try {
    if (!/^[0-9a-f]{56,120}$/.test(unit)) {
      throw new ApiError(400, "Invalid asset unit", "Expected hex policyId + assetNameHex (56-120 hex chars).");
    }
    if (!TIMEFRAMES.has(tf)) {
      throw new ApiError(400, `Unsupported timeframe "${tf}"`, "Use tf=15m, 1h, 4h, or 1d.");
    }
    if (poolParam && !POOL_RE.test(poolParam.toLowerCase())) {
      throw new ApiError(400, "Invalid pool address", "Pass the pool address hex from the token's pairs list.");
    }
    // limit only slices the response — it is NOT part of the upstream fetch
    // or cache key, so it can't be used to mint distinct GT calls.
    const limit = limitParam ? parseInt(limitParam, 10) : 300;
    if (!Number.isFinite(limit) || limit < 1 || limit > 500) {
      throw new ApiError(400, "Invalid limit", "limit must be 1-500.");
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

    // Always fetch the full window upstream (single cache key per pool+tf);
    // client limit only trims the tail we return.
    const full = await getOhlcv(poolAddress, tf as GeckoTimeframe, 500);
    const ohlcv = { ...full, candles: full.candles.slice(-limit) };
    if (ohlcv.candles.length === 0) {
      return NextResponse.json(
        {
          error: "No candles for this pool/timeframe",
          hint: "The pool exists but GeckoTerminal returned no OHLCV rows. Try a coarser timeframe (tf=1d).",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        asset: unit,
        pool: {
          address: poolAddress,
          dexId: pool?.dexId ?? "minswap",
          name: pool?.name ?? ohlcv.poolLabel ?? poolAddress,
        },
        tf,
        quote: ohlcv.quote, // candles are USD-denominated (verified vs GT meta)
        candles: ohlcv.candles,
        coverage: "Chart: top pool via GeckoTerminal (includes Minswap)",
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
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
