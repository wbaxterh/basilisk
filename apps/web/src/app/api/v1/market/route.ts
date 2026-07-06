import { NextRequest, NextResponse } from "next/server";
import { getAdaMarket, getAdaSeries, getEcosystemTokens } from "@/lib/dex-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ADA market snapshot + price series (+ optional CoinGecko ecosystem list). */
export async function GET(req: NextRequest) {
  const daysParam = req.nextUrl.searchParams.get("days");
  const days = daysParam ? parseInt(daysParam, 10) : 1;
  const wantEcosystem = req.nextUrl.searchParams.get("ecosystem") === "1";
  try {
    const [ada, series, ecosystem] = await Promise.all([
      getAdaMarket(),
      getAdaSeries(Number.isFinite(days) && days > 0 ? days : 1),
      wantEcosystem ? getEcosystemTokens() : Promise.resolve(undefined),
    ]);
    return NextResponse.json(
      { ada, series, ...(ecosystem ? { ecosystem } : {}) },
      { headers: { "Cache-Control": "public, s-maxage=90, stale-while-revalidate=180" } }
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: "Market data temporarily unavailable",
        hint: e instanceof Error ? e.message : "Upstream CoinGecko request failed.",
      },
      { status: 502 }
    );
  }
}
