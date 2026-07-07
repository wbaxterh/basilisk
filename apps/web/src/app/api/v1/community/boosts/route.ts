import { NextRequest, NextResponse } from "next/server";

import { ApiError } from "@/lib/dex-data";
import {
  UNIT_RE,
  addBoost,
  getBoostSummary,
  parseBoostPayload,
  verifyWalletSignature,
} from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UNITS = 60;
const MAX_BODY_BYTES = 8 * 1024;

/**
 * GET /api/v1/community/boosts?units=a,b,c → boost summaries per unit.
 * Free, democratic boosts: one wallet signature = one boost per UTC day
 * (no 300-ADA pay-to-play).
 */
export async function GET(req: NextRequest) {
  const unitsParam = req.nextUrl.searchParams.get("units") ?? "";
  const units = Array.from(
    new Set(
      unitsParam
        .split(",")
        .map((u) => u.trim().toLowerCase())
        .filter((u) => u.length > 0)
    )
  );

  if (units.length === 0) {
    return NextResponse.json(
      { error: "Missing units", hint: "Pass ?units=<unit>,<unit> (policyId + assetNameHex, up to 60)." },
      { status: 400 }
    );
  }
  if (units.length > MAX_UNITS) {
    return NextResponse.json(
      { error: "Too many units", hint: `At most ${MAX_UNITS} units per request.` },
      { status: 400 }
    );
  }
  const bad = units.find((u) => !UNIT_RE.test(u));
  if (bad) {
    return NextResponse.json(
      { error: "Invalid asset unit", hint: `"${bad}" is not lowercase hex policyId + assetNameHex (56-120 chars).` },
      { status: 400 }
    );
  }

  try {
    const summaries = await getBoostSummary(units);
    return NextResponse.json(
      { summaries },
      // no-store: boost counts must reflect a just-cast boost immediately.
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message, hint: e.hint }, { status: e.status });
    }
    return NextResponse.json(
      { error: "Boost summary temporarily unavailable", hint: e instanceof Error ? e.message : "Database query failed." },
      { status: 502 }
    );
  }
}

interface SignedBody {
  payload?: unknown;
  signature?: unknown;
  key?: unknown;
  rewardAddressHex?: unknown;
}

/**
 * POST /api/v1/community/boosts
 * Body: { payload: <signed JSON string>, signature, key, rewardAddressHex }
 * payload is a BoostPayload {action:"boost", unit, day:"YYYY-MM-DD" (today UTC)}.
 */
export async function POST(req: NextRequest) {
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "Could not read request body" }, { status: 400 });
  }
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body too large", hint: "Boost requests must be under 8 KB." },
      { status: 413 }
    );
  }

  let body: SignedBody;
  try {
    body = JSON.parse(raw) as SignedBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { payload, signature, key, rewardAddressHex } = body;
  if (
    typeof payload !== "string" ||
    typeof signature !== "string" ||
    typeof key !== "string" ||
    typeof rewardAddressHex !== "string"
  ) {
    return NextResponse.json(
      {
        error: "Missing signed fields",
        hint: "Expected { payload, signature, key, rewardAddressHex } — all strings, from CIP-30 signData.",
      },
      { status: 400 }
    );
  }

  try {
    const boost = parseBoostPayload(payload);
    const { stakeAddress } = verifyWalletSignature({
      signatureCose: signature,
      keyCose: key,
      payloadJson: payload,
      rewardAddressHex,
    });

    await addBoost(boost.unit, stakeAddress, boost.day);
    return NextResponse.json({ ok: true, stakeAddress, unit: boost.unit }, { status: 201 });
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 409) {
        let boostedUnit: string | undefined;
        try {
          boostedUnit = (JSON.parse(payload) as { unit?: string }).unit;
        } catch {
          boostedUnit = undefined;
        }
        return NextResponse.json(
          { error: "Already boosted today", boostedUnit, hint: e.hint },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: e.message, hint: e.hint }, { status: e.status });
    }
    return NextResponse.json(
      { error: "Boost failed", hint: e instanceof Error ? e.message : "Unexpected error." },
      { status: 502 }
    );
  }
}
