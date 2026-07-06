import { NextResponse } from "next/server";
import { getScreener } from "@/lib/dex-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Screener: registry tokens enriched with live DexScreener data. */
export async function GET() {
  try {
    const data = await getScreener();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=45, stale-while-revalidate=120" },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Screener temporarily unavailable",
        hint: e instanceof Error ? e.message : "Upstream DexScreener request failed.",
      },
      { status: 502 }
    );
  }
}
