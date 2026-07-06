/**
 * Basilisk hosted MCP server — /api/mcp
 *
 * The first hosted MCP server purpose-built for Cardano market data.
 * Streamable HTTP only (no SSE, no Redis needed). Tools call the shared
 * data layer in src/lib/dex-data.ts directly — no self-HTTP hops.
 *
 * Route convention (mcp-handler): app/api/[transport]/route.ts with
 * basePath "/api" → the streamable HTTP endpoint resolves to /api/mcp.
 *
 * Connect:
 *   claude mcp add --transport http basilisk <APP_URL>/api/mcp
 */
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  ApiError,
  COVERAGE,
  getAdaMarket,
  getChainTip,
  getScreener,
  getTokenDetail,
  getWallet,
  searchTokens,
  type ScreenerToken,
} from "@/lib/dex-data";

export const runtime = "nodejs";
export const maxDuration = 60;

const INSTRUCTIONS = [
  "Basilisk is a free hosted MCP server for Cardano market data: token screener, token detail,",
  "search, wallet intelligence, ADA market snapshot, and chain tip. No API key, no payment —",
  "all tools are free to call.",
  `Coverage honesty: DEX aggregates (price/volume/liquidity) cover ${COVERAGE} — never treat them`,
  "as total Cardano volume or liquidity. ADA market data comes from CoinGecko; on-chain facts",
  "(supply, holders, chain tip, wallet balances) come from Koios. Every response includes a",
  "`coverage` field naming its source. Asset units are hex policyId + assetNameHex. Wallets accept",
  "$handle, addr1..., or stake1... inputs. A free REST mirror lives at /api/v1.",
].join(" ");

type SortKey = "liquidity" | "volume" | "gainers" | "losers" | "new";

function sortScreener(tokens: ScreenerToken[], sort: SortKey): ScreenerToken[] {
  const list = [...tokens];
  switch (sort) {
    case "volume":
      return list.sort((a, b) => b.volume24h - a.volume24h);
    case "gainers":
      return list
        .filter((t) => t.change24h != null)
        .sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
    case "losers":
      return list
        .filter((t) => t.change24h != null)
        .sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0));
    case "new":
      return list
        .filter((t) => t.pairCreatedAt != null)
        .sort((a, b) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0));
    case "liquidity":
    default:
      return list; // getScreener() already sorts by liquidity desc
  }
}

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err: unknown) {
  const message =
    err instanceof ApiError
      ? `${err.message}${err.hint ? ` — ${err.hint}` : ""}`
      : err instanceof Error
        ? `Upstream data delayed: ${err.message}`
        : "Upstream data delayed. Try again shortly.";
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: message, coverage: COVERAGE }) }],
  };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_tokens",
      {
        title: "Search Cardano tokens",
        description:
          "Search Cardano native tokens by ticker or name (e.g. \"SNEK\", \"hosky\"). Returns matching tokens with live USD price, 24h volume, liquidity, price changes, and the asset unit (policyId + assetNameHex) to pass to get_token. " +
          `DEX data coverage: ${COVERAGE}.`,
        inputSchema: {
          query: z.string().min(1).max(64).describe("Ticker or name to search for, e.g. \"SNEK\""),
        },
      },
      async ({ query }) => {
        try {
          return jsonResult(await searchTokens(query));
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      "get_screener",
      {
        title: "Cardano token screener",
        description:
          "Live screener of curated Cardano native tokens with USD price, 1h/6h/24h change, 24h volume, liquidity, market cap, and buy/sell transaction counts, aggregated across DEX pairs. Sort by liquidity (default), volume, gainers, losers, or new (pair creation time). " +
          `DEX data coverage: ${COVERAGE} — not total Cardano volume/liquidity.`,
        inputSchema: {
          sort: z
            .enum(["liquidity", "volume", "gainers", "losers", "new"])
            .optional()
            .describe("Sort order. Default: liquidity"),
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .optional()
            .describe("Max tokens to return (1-50). Default: 25"),
        },
      },
      async ({ sort, limit }) => {
        try {
          const screener = await getScreener();
          const tokens = sortScreener(screener.tokens, sort ?? "liquidity").slice(0, limit ?? 25);
          return jsonResult({
            coverage: screener.coverage,
            updatedAt: screener.updatedAt,
            sort: sort ?? "liquidity",
            count: tokens.length,
            tokens,
          });
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      "get_token",
      {
        title: "Cardano token detail",
        description:
          "Full detail for one Cardano native token by asset unit (hex policyId + assetNameHex, e.g. SNEK = \"279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b\"): per-DEX pair rows, aggregated price/volume/liquidity, total supply, decimals, fingerprint, mint time, registry description, and estimated holder count. Use search_tokens first if you only know the ticker. " +
          `DEX data coverage: ${COVERAGE}.`,
        inputSchema: {
          asset: z
            .string()
            .regex(/^[0-9a-fA-F]{56,120}$/, "hex policyId + assetNameHex (56-120 hex chars)")
            .describe("Asset unit: policyId + assetNameHex in hex"),
        },
      },
      async ({ asset }) => {
        try {
          const detail = await getTokenDetail(asset);
          if (!detail) {
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: "Token not found on DexScreener or Koios.",
                    hint: "Check the asset unit, or use search_tokens to find it.",
                    coverage: COVERAGE,
                  }),
                },
              ],
            };
          }
          return jsonResult(detail);
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      "get_wallet",
      {
        title: "Cardano wallet overview",
        description:
          "Wallet intelligence for any Cardano wallet: ADA balance, staking rewards, delegated pool, and native-token holdings with USD values where a DEX price exists. Accepts an ADA Handle (\"$wes\"), a payment address (\"addr1...\"), or a stake address (\"stake1...\"). " +
          `Token pricing coverage: ${COVERAGE}; balances via Koios.`,
        inputSchema: {
          address: z
            .string()
            .min(2)
            .max(120)
            .describe("$handle, addr1..., or stake1... wallet identifier"),
        },
      },
      async ({ address }) => {
        try {
          return jsonResult(await getWallet(address));
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      "get_ada_price",
      {
        title: "ADA market snapshot",
        description:
          "Current ADA (Cardano) market snapshot: USD price, 24h change %, market cap, and 24h volume. Source: CoinGecko (CEX + DEX pricing).",
        inputSchema: {},
      },
      async () => {
        try {
          const market = await getAdaMarket();
          return jsonResult({ ...market, coverage: "CoinGecko (CEX + DEX)" });
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      "get_chain_tip",
      {
        title: "Cardano chain tip",
        description:
          "Latest Cardano mainnet block: block number, epoch, epoch slot, block hash, and block time (unix seconds). Useful as a liveness/freshness check. Source: Koios.",
        inputSchema: {},
      },
      async () => {
        try {
          const tip = await getChainTip();
          return jsonResult({ ...tip, coverage: "Koios (Cardano mainnet)" });
        } catch (err) {
          return errorResult(err);
        }
      }
    );
  },
  {
    serverInfo: { name: "basilisk", version: "0.2.0" },
    capabilities: { tools: {} },
    instructions: INSTRUCTIONS,
  },
  {
    basePath: "/api", // file lives at app/api/[transport]/route.ts → endpoint /api/mcp
    maxDuration: 60,
    disableSse: true, // streamable HTTP only — no Redis required
  }
);

export { handler as GET, handler as POST };
