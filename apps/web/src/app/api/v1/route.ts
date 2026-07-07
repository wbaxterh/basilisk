import { NextRequest, NextResponse } from "next/server";
import { COVERAGE } from "@/lib/dex-data";
import { APP_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Self-describing index of the free public Basilisk v1 API. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl?.origin || APP_URL;
  return NextResponse.json(
    {
      name: "Basilisk API",
      version: "1.0.0",
      description:
        "Free public Cardano market data API — screener, token detail, search, wallets, ADA market. No key required.",
      coverage: COVERAGE,
      endpoints: [
        {
          path: "/api/v1/tokens",
          method: "GET",
          description:
            "Screener: curated Cardano native tokens with live price, volume, liquidity, txns (aggregated across DexScreener pairs).",
          example: `${origin}/api/v1/tokens`,
        },
        {
          path: "/api/v1/tokens/{asset}",
          method: "GET",
          description:
            "Token detail by asset unit (policyId + assetNameHex): per-pair rows, supply, decimals, fingerprint, holder estimate.",
          example: `${origin}/api/v1/tokens/279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b`,
        },
        {
          path: "/api/v1/search",
          method: "GET",
          description: "Search Cardano tokens by ticker or name via DexScreener.",
          example: `${origin}/api/v1/search?q=SNEK`,
        },
        {
          path: "/api/v1/wallet/{address}",
          method: "GET",
          description:
            "Wallet overview for addr1..., stake1..., or $handle (URL-encode $ as %24): ADA balance, rewards, pool, holdings with USD values where priced.",
          example: `${origin}/api/v1/wallet/%24wes`,
        },
        {
          path: "/api/v1/market",
          method: "GET",
          description:
            "ADA market snapshot + price series (?days=1..365) + optional CoinGecko cardano-ecosystem list (?ecosystem=1).",
          example: `${origin}/api/v1/market?days=1&ecosystem=1`,
        },
        {
          path: "/api/v1/tokens/{asset}/ohlcv",
          method: "GET",
          description:
            "OHLCV candles (USD) for the token's top pool via GeckoTerminal (includes Minswap). ?tf=15m|1h|4h|1d, ?limit=1-500.",
          example: `${origin}/api/v1/tokens/279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b/ohlcv?tf=1h`,
        },
        {
          path: "/api/v1/community/boosts",
          method: "GET/POST",
          description:
            "Community boosts. GET ?units=a,b,c returns 24h/7d/today counts; POST casts one free boost per wallet per UTC day (CIP-30 signed payload).",
          example: `${origin}/api/v1/community/boosts?units=279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b`,
        },
        {
          path: "/api/v1/community/comments/{unit}",
          method: "GET/POST",
          description:
            "Token discussion. GET lists the latest 50 comments; POST adds one (CIP-30 signed payload, 10/day per stake address).",
          example: `${origin}/api/v1/community/comments/279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b`,
        },
      ],
      docs: `${origin}/docs`,
      mcp: `${origin}/api/mcp`,
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
