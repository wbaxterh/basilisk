import { NextRequest, NextResponse } from "next/server";

import { ApiError } from "@/lib/dex-data";
import {
  UNIT_RE,
  addComment,
  getComments,
  parseCommentPayload,
  verifyWalletSignature,
} from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;

function invalidUnitResponse(unit: string) {
  return NextResponse.json(
    {
      error: "Invalid asset unit",
      hint: `"${unit}" is not lowercase hex policyId + assetNameHex (56-120 chars).`,
    },
    { status: 400 }
  );
}

/**
 * GET /api/v1/community/comments/:unit → latest 50 comments, newest first.
 * Stake addresses are public on-chain data, so both the full address and a
 * short display form are returned.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ unit: string }> }
) {
  const { unit: rawUnit } = await params;
  const unit = decodeURIComponent(rawUnit).toLowerCase();
  if (!UNIT_RE.test(unit)) return invalidUnitResponse(unit);

  try {
    const comments = await getComments(unit, 50);
    return NextResponse.json(
      {
        unit,
        count: comments.length,
        comments: comments.map((c) => ({
          id: c.id,
          stakeAddress: c.stakeAddress,
          stakeShort: c.stakeShort,
          body: c.body,
          createdAt: c.createdAt,
        })),
      },
      // no-store: CDN caching here makes just-posted comments vanish on the
      // next poll; these are cheap indexed Neon reads.
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message, hint: e.hint }, { status: e.status });
    }
    return NextResponse.json(
      { error: "Comments temporarily unavailable", hint: e instanceof Error ? e.message : "Database query failed." },
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
 * POST /api/v1/community/comments/:unit
 * Body: { payload: <signed JSON string>, signature, key, rewardAddressHex }
 * payload is a CommentPayload {action:"comment", unit, body, ts:ISO} — unit
 * must match the route, ts within ±5 minutes, body 1-500 chars after trim.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ unit: string }> }
) {
  const { unit: rawUnit } = await params;
  const unit = decodeURIComponent(rawUnit).toLowerCase();
  if (!UNIT_RE.test(unit)) return invalidUnitResponse(unit);

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "Could not read request body" }, { status: 400 });
  }
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body too large", hint: "Comment requests must be under 8 KB (body max 500 chars)." },
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
    const comment = parseCommentPayload(payload);
    if (comment.unit !== unit) {
      return NextResponse.json(
        {
          error: "Payload unit mismatch",
          hint: `The signed payload targets "${comment.unit}" but this route is for "${unit}".`,
        },
        { status: 400 }
      );
    }

    const { stakeAddress } = verifyWalletSignature({
      signatureCose: signature,
      keyCose: key,
      payloadJson: payload,
      rewardAddressHex,
    });

    const saved = await addComment(unit, stakeAddress, comment.body, comment.ts);
    return NextResponse.json(
      { ok: true, stakeAddress, unit, comment: saved },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message, hint: e.hint }, { status: e.status });
    }
    return NextResponse.json(
      { error: "Comment failed", hint: e instanceof Error ? e.message : "Unexpected error." },
      { status: 502 }
    );
  }
}
