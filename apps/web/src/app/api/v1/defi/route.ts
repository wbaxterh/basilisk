import { NextResponse } from "next/server";
import { getDefiOverview } from "@/lib/defi-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cardano DeFi scoreboard: chain TVL series, stablecoin supply, and top
 * protocols by Cardano TVL — all from DefiLlama's free endpoints, cached
 * 10 min server-side (defi-data.ts) + CDN s-maxage below.
 */
export async function GET() {
  try {
    const overview = await getDefiOverview();
    return NextResponse.json(overview, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "DeFi data temporarily unavailable",
        hint: e instanceof Error ? e.message : "Upstream DefiLlama request failed.",
      },
      { status: 502 }
    );
  }
}
