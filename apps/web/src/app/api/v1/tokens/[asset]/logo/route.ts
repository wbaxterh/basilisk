import { NextRequest, NextResponse } from "next/server";

import { TOKEN_IMAGE_URLS } from "@/data/token-images";
import { TOKEN_REGISTRY_BY_ADDRESS } from "@/data/token-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Token logo by Cardano asset unit — never 5xx for a valid unit.
 *
 * PRIMARY   Cardano Token Registry via Koios POST /asset_info:
 *           token_registry_metadata.logo is base64 PNG (verified 30/30
 *           registry tokens, 2.4-63.6 KB, 2026-07-11). Served as raw
 *           image/png bytes with long CDN caching.
 * SECONDARY generated TOKEN_IMAGE_URLS map (GeckoTerminal image_url on the
 *           CoinGecko CDN, hotlinkable) → 307 redirect.
 * FALLBACK  deterministic 64x64 SVG monogram derived from the policy id —
 *           the floor for any valid unit.
 */

const KOIOS_BASE = "https://api.koios.rest/api/v1";
const UNIT_RE = /^[0-9a-f]{56,120}$/;
/** PNG magic: 89 50 4E 47. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const PNG_HEADERS = {
  "Content-Type": "image/png",
  "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
  "X-Content-Type-Options": "nosniff",
} as const;

// ---------------------------------------------------------------------------
// Bounded LRU of decoded PNG buffers so warm lambdas skip Koios entirely.
// `null` = negative entry (Koios answered but had no usable PNG) so repeat
// requests fall straight through to the redirect/monogram tiers.
// ---------------------------------------------------------------------------

const MAX_LOGO_ENTRIES = 200;
const logoCache = new Map<string, Buffer | null>();

function logoCacheGet(unit: string): Buffer | null | undefined {
  const hit = logoCache.get(unit);
  if (hit !== undefined) {
    // Refresh recency (Map preserves insertion order → first key is LRU).
    logoCache.delete(unit);
    logoCache.set(unit, hit);
  }
  return hit;
}

function logoCacheSet(unit: string, value: Buffer | null): void {
  logoCache.delete(unit);
  while (logoCache.size >= MAX_LOGO_ENTRIES) {
    const oldest = logoCache.keys().next().value;
    if (oldest == null) break;
    logoCache.delete(oldest);
  }
  logoCache.set(unit, value);
}

// ---------------------------------------------------------------------------
// PRIMARY: Koios asset_info → base64 PNG (dex-data does not export its koios
// helpers, so a local fetch with the same 15 s AbortController timeout).
// ---------------------------------------------------------------------------

interface KoiosLogoRow {
  policy_id: string;
  asset_name: string | null;
  token_registry_metadata: { logo?: string | null } | null;
}

async function fetchKoiosLogo(unit: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${KOIOS_BASE}/asset_info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _asset_list: [[unit.slice(0, 56), unit.slice(56)]] }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as KoiosLogoRow[];
    const b64 = rows?.[0]?.token_registry_metadata?.logo;
    if (typeof b64 !== "string" || b64.length === 0) return null;
    const buf = Buffer.from(b64, "base64");
    // Verify PNG magic — registry data is third-party supplied.
    if (buf.length < 8 || !buf.subarray(0, 4).equals(PNG_MAGIC)) return null;
    return buf;
  } catch {
    return null; // Koios failures fall through silently to the next tier
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// FALLBACK: deterministic SVG monogram (64x64, hue from policy id hash).
// ---------------------------------------------------------------------------

/** FNV-1a over the policy id → stable 0-359 hue per token family. */
function policyHue(policyId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < policyId.length; i++) {
    h ^= policyId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 360;
}

function monogramSvg(unit: string): string {
  const policyId = unit.slice(0, 56);
  const ticker = TOKEN_REGISTRY_BY_ADDRESS.get(unit)?.symbol;
  const letters = (ticker ?? unit).slice(0, 2).toUpperCase();
  const hue = policyHue(policyId);
  const bg = `hsl(${hue},45%,16%)`;
  const fg = `hsl(${hue},80%,70%)`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${letters}">`,
    `<rect width="64" height="64" rx="12" fill="${bg}"/>`,
    `<text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-family="'JetBrains Mono','SFMono-Regular',Menlo,monospace" font-size="24" font-weight="700" fill="${fg}">${letters}</text>`,
    `</svg>`,
  ].join("");
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ asset: string }> }
) {
  const { asset } = await params;
  const unit = decodeURIComponent(asset).toLowerCase();
  if (!UNIT_RE.test(unit)) {
    return NextResponse.json(
      {
        error: "Invalid asset unit",
        hint: "Expected hex policyId + assetNameHex (56-120 hex chars).",
      },
      { status: 400 }
    );
  }

  // PRIMARY — Cardano Token Registry PNG (LRU first, then Koios).
  let png = logoCacheGet(unit);
  if (png === undefined) {
    png = await fetchKoiosLogo(unit);
    logoCacheSet(unit, png);
  }
  if (png) {
    return new NextResponse(new Uint8Array(png), { headers: PNG_HEADERS });
  }

  // SECONDARY — GT/CoinGecko CDN redirect from the generated map.
  const imageUrl = TOKEN_IMAGE_URLS[unit];
  if (imageUrl) {
    return NextResponse.redirect(imageUrl, {
      status: 307,
      headers: { "Cache-Control": "public, s-maxage=86400" },
    });
  }

  // FALLBACK — deterministic monogram; also the negative cache for units
  // nobody has art for (valid units never 5xx).
  return new NextResponse(monogramSvg(unit), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
