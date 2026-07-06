import { NextResponse } from "next/server";

export const runtime = "edge";

// Koios is CORS-unfriendly from browsers; we proxy server-side and cache
// the response briefly so a tab refresh doesn't slam upstream.
export async function GET() {
  try {
    const res = await fetch("https://api.koios.rest/api/v1/tip", {
      next: { revalidate: 15 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: { code: "UPSTREAM_FAILED", message: `Koios returned ${res.status}` } },
        { status: 502 }
      );
    }
    const rows = (await res.json()) as Array<{
      hash: string;
      epoch_no: number;
      abs_slot: number;
      epoch_slot: number;
      block_no: number;
      block_time: number;
    }>;
    const tip = rows[0];
    if (!tip) {
      return NextResponse.json({ data: null }, { status: 200 });
    }
    return NextResponse.json(
      {
        data: {
          block: tip.block_no,
          epoch: tip.epoch_no,
          epochSlot: tip.epoch_slot,
          hash: tip.hash,
          blockTime: tip.block_time,
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=15, s-maxage=15",
        },
      }
    );
  } catch (e) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: e instanceof Error ? e.message : "unknown" } },
      { status: 502 }
    );
  }
}
