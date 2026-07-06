import { NextRequest, NextResponse } from "next/server";
import { ApiError, getTokenDetail } from "@/lib/dex-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Token detail by Cardano asset unit (policyId + assetNameHex). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ asset: string }> }
) {
  const { asset } = await params;
  try {
    const detail = await getTokenDetail(decodeURIComponent(asset));
    if (!detail) {
      return NextResponse.json(
        {
          error: "Token not found",
          hint: "No DexScreener pairs and no Koios asset info for this unit. Expected {policyId}{assetNameHex}, e.g. 279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b (SNEK).",
        },
        { status: 404 }
      );
    }
    return NextResponse.json(detail, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180" },
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message, hint: e.hint }, { status: e.status });
    }
    return NextResponse.json(
      {
        error: "Token detail temporarily unavailable",
        hint: e instanceof Error ? e.message : "Upstream request failed.",
      },
      { status: 502 }
    );
  }
}
