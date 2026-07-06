import { NextRequest, NextResponse } from "next/server";
import { ApiError, searchTokens } from "@/lib/dex-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Search Cardano tokens by ticker or name. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const data = await searchTokens(q);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=90" },
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message, hint: e.hint }, { status: e.status });
    }
    return NextResponse.json(
      {
        error: "Search temporarily unavailable",
        hint: e instanceof Error ? e.message : "Upstream DexScreener request failed.",
      },
      { status: 502 }
    );
  }
}
