import { NextRequest, NextResponse } from "next/server";
import { ApiError, getWallet } from "@/lib/dex-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Wallet overview for addr1..., stake1..., or $handle ($ URL-encoded as %24). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  try {
    const wallet = await getWallet(decodeURIComponent(address));
    return NextResponse.json(wallet, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=90" },
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message, hint: e.hint }, { status: e.status });
    }
    return NextResponse.json(
      {
        error: "Wallet lookup temporarily unavailable",
        hint: e instanceof Error ? e.message : "Upstream Koios/handle.me request failed.",
      },
      { status: 502 }
    );
  }
}
