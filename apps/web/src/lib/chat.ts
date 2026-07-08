/**
 * Ask Basilisk — server-side chat brain shared by /api/chat.
 *
 * Mirrors the MCP server's tool surface (src/app/api/[transport]/route.ts)
 * as Anthropic tool definitions over the same data layer (src/lib/dex-data.ts),
 * plus a per-IP daily quota backed by Neon (community.ts idioms) with an
 * in-memory best-effort fallback when no database is configured.
 *
 * NOT for the browser.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";

import {
  ApiError,
  COVERAGE,
  COVERAGE_WITH_MINSWAP,
  getAdaMarket,
  getChainTip,
  getScreener,
  getTokenDetail,
  getWallet,
  searchTokens,
  type ScreenerToken,
} from "@/lib/dex-data";

// ---------------------------------------------------------------------------
// Tool definitions — order is deterministic (tools render before system in the
// prompt, so a stable array keeps the tools+system cache_control prefix warm).
// Semantics mirror the MCP server's registerTool descriptions/validation.
// ---------------------------------------------------------------------------

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_tokens",
    description:
      "Search Cardano native tokens by ticker or name (e.g. \"SNEK\", \"hosky\"). Returns matching tokens with live USD price, 24h volume, liquidity, price changes, and the asset unit (policyId + assetNameHex) to pass to get_token. " +
      "Call this whenever the user mentions a token by ticker or name and you do not already have its asset unit — never guess units or answer token questions from memory. " +
      `DEX data coverage: ${COVERAGE}.`,
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          minLength: 1,
          maxLength: 64,
          description: "Ticker or name to search for, e.g. \"SNEK\"",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_screener",
    description:
      "Live screener of curated Cardano native tokens with USD price, 1h/6h/24h change, 24h volume, liquidity, market cap, and buy/sell transaction counts, aggregated across DEX pairs. " +
      "Call this whenever the user asks about prices, momentum, liquidity, gainers/losers, buy pressure, or what's moving on Cardano — never answer market questions from memory. " +
      `Sort by liquidity (default), volume, gainers, losers, or new (pair creation time). DEX data coverage: ${COVERAGE} — not total Cardano volume/liquidity.`,
    input_schema: {
      type: "object",
      properties: {
        sort: {
          type: "string",
          enum: ["liquidity", "volume", "gainers", "losers", "new"],
          description: "Sort order. Default: liquidity",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          description: "Max tokens to return (1-50). Default: 25",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_token",
    description:
      "Full detail for one Cardano native token by asset unit (hex policyId + assetNameHex, e.g. SNEK = \"279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b\"): per-DEX pair rows, aggregated price/volume/liquidity, total supply, decimals, fingerprint, mint time, registry description, and estimated holder count. " +
      "Call this whenever the user asks about a specific token's price, pools, supply, or holders and you have its asset unit — use search_tokens first if you only know the ticker. " +
      `DEX data coverage: ${COVERAGE}.`,
    input_schema: {
      type: "object",
      properties: {
        asset: {
          type: "string",
          pattern: "^[0-9a-f]{56,120}$",
          description: "Asset unit: policyId + assetNameHex in lowercase hex (56-120 hex chars)",
        },
      },
      required: ["asset"],
      additionalProperties: false,
    },
  },
  {
    name: "get_wallet",
    description:
      "Wallet intelligence for any Cardano wallet: ADA balance, staking rewards, delegated pool, and native-token holdings with USD values where a DEX price exists. Accepts an ADA Handle (\"$wes\"), a payment address (\"addr1...\"), or a stake address (\"stake1...\"). " +
      "Call this whenever the user asks about a wallet, address, handle, portfolio, balance, or holdings — never estimate balances from memory. " +
      `Token pricing coverage: ${COVERAGE}; balances via Koios.`,
    input_schema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          minLength: 2,
          maxLength: 120,
          description: "$handle, addr1..., or stake1... wallet identifier",
        },
      },
      required: ["address"],
      additionalProperties: false,
    },
  },
  {
    name: "get_ada_price",
    description:
      "Current ADA (Cardano) market snapshot: USD price, 24h change %, market cap, and 24h volume. Source: CoinGecko (CEX + DEX pricing). " +
      "Call this whenever the user asks about ADA's price, market cap, or how Cardano itself is doing — never quote an ADA price from memory.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_chain_tip",
    description:
      "Latest Cardano mainnet block: block number, epoch, epoch slot, block hash, and block time (unix seconds). Source: Koios. " +
      "Call this whenever the user asks about the current block, epoch, slot, or whether the chain/data is live — it doubles as a freshness check.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

/** Human phrases the route streams as tool chips while a tool runs. */
export const TOOL_LABELS: Record<string, string> = {
  search_tokens: "Searching tokens…",
  get_screener: "Checking the screener…",
  get_token: "Pulling token detail…",
  get_wallet: "Profiling the wallet…",
  get_ada_price: "Fetching the ADA price…",
  get_chain_tip: "Checking the chain tip…",
};

// ---------------------------------------------------------------------------
// Tool execution — dispatch to the shared data layer, JSON results as strings.
// ---------------------------------------------------------------------------

export interface ToolExecution {
  /** JSON string to place in the tool_result block. */
  text: string;
  /** True → send with is_error so the model treats it as a failure. */
  isError: boolean;
}

const SORT_KEYS = ["liquidity", "volume", "gainers", "losers", "new"] as const;
type SortKey = (typeof SORT_KEYS)[number];

/** Same sort semantics as the MCP route's get_screener. */
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

function ok(data: unknown): ToolExecution {
  return { text: JSON.stringify(data), isError: false };
}

function fail(error: string, hint?: string | null): ToolExecution {
  return { text: JSON.stringify({ error, hint: hint ?? null }), isError: true };
}

export async function executeTool(name: string, input: unknown): Promise<ToolExecution> {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  try {
    switch (name) {
      case "search_tokens": {
        const query = typeof args.query === "string" ? args.query : "";
        return ok(await searchTokens(query));
      }
      case "get_screener": {
        const sort: SortKey = SORT_KEYS.includes(args.sort as SortKey)
          ? (args.sort as SortKey)
          : "liquidity";
        const rawLimit = typeof args.limit === "number" ? Math.floor(args.limit) : 25;
        const limit = Math.min(Math.max(rawLimit, 1), 50);
        const screener = await getScreener();
        const tokens = sortScreener(screener.tokens, sort).slice(0, limit);
        return ok({
          coverage: screener.coverage,
          updatedAt: screener.updatedAt,
          sort,
          count: tokens.length,
          tokens,
        });
      }
      case "get_token": {
        const asset = typeof args.asset === "string" ? args.asset : "";
        const detail = await getTokenDetail(asset);
        if (!detail) {
          return fail(
            "Token not found on DexScreener or Koios.",
            "Check the asset unit, or use search_tokens to find it."
          );
        }
        return ok(detail);
      }
      case "get_wallet": {
        const address = typeof args.address === "string" ? args.address : "";
        return ok(await getWallet(address));
      }
      case "get_ada_price": {
        const market = await getAdaMarket();
        return ok({ ...market, coverage: "CoinGecko (CEX + DEX)" });
      }
      case "get_chain_tip": {
        const tip = await getChainTip();
        return ok({ ...tip, coverage: "Koios (Cardano mainnet)" });
      }
      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err instanceof ApiError) return fail(err.message, err.hint);
    return fail("Upstream data delayed. Try again shortly.", "Live sources can lag — retry the tool.");
  }
}

// ---------------------------------------------------------------------------
// System prompt — FROZEN constant: no timestamps or per-request interpolation
// (it carries cache_control; any byte change would invalidate the cache).
// The current date is injected into the first user turn by the route instead.
// ---------------------------------------------------------------------------

export const SYSTEM = `You are Basilisk, the in-app AI analyst for the Basilisk Cardano analytics platform. You answer questions about Cardano tokens, wallets, and the market using live data.

Rules:
- ALWAYS use your tools for market data — prices, volume, liquidity, momentum, balances, blocks. Never invent or recall numbers from memory; if a tool fails, say the data is delayed rather than guessing.
- Coverage honesty: your DEX aggregates cover ${COVERAGE_WITH_MINSWAP}. Say so when totals matter, and never present them as "total Cardano volume" or "total Cardano liquidity". ADA market data comes from CoinGecko; on-chain facts (supply, holders, chain tip, wallet balances) come from Koios.
- Be concise. Format for a monospace-friendly chat panel: plain text plus simple markdown only — **bold** for emphasis and \`inline code\` for numbers, tickers, asset units, and addresses. No headings, no tables.
- You are not a financial advisor. If asked whether to buy, sell, or hold, say clearly that you don't give financial advice, then share the relevant data neutrally.
- Link app pages when relevant: a token's page is /tokens/{unit} (unit = hex policyId + assetNameHex), the screener is /screener, and portfolio tools are at /portfolio.
- If asked about the platform itself: Basilisk offers a free REST API at /api/v1 and a free hosted MCP server at /api/mcp that expose these same tools.`;

// ---------------------------------------------------------------------------
// Rate limit — 20 chats per IP per UTC day. Neon-backed when a database is
// configured (single atomic upsert, same lazy-schema idiom as community.ts);
// otherwise a best-effort in-memory Map per instance.
// ---------------------------------------------------------------------------

export const CHAT_DAILY_LIMIT = 20;

type Sql = ReturnType<typeof neon<false, false>>;

function getConnStr(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL
  );
}

let chatSchemaReady = false;
async function ensureChatSchema(sql: Sql): Promise<void> {
  if (chatSchemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS basilisk_chat_usage (
      day   DATE NOT NULL,
      ip    TEXT NOT NULL,
      count INT  NOT NULL DEFAULT 1,
      UNIQUE (day, ip)
    )
  `;
  chatSchemaReady = true;
}

function quotaError(): ApiError {
  return new ApiError(
    429,
    "Daily chat limit reached",
    `Each visitor gets ${CHAT_DAILY_LIMIT} messages per UTC day — resets at midnight UTC.`
  );
}

/** Best-effort fallback when no DB is configured (per serverless instance). */
const memoryQuota = new Map<string, number>();

/**
 * Count one chat message for `ip` today, throwing ApiError(429) once the
 * daily limit is exceeded. With a database this is ONE atomic statement:
 * the conditional upsert only increments while under the limit, so an empty
 * RETURNING set means over quota — no read-then-write race between lambdas.
 */
export async function checkChatQuota(ip: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const connStr = getConnStr();

  if (!connStr) {
    const key = `${day}:${ip}`;
    for (const k of memoryQuota.keys()) {
      if (!k.startsWith(`${day}:`)) memoryQuota.delete(k); // drop stale days
    }
    const count = (memoryQuota.get(key) ?? 0) + 1;
    if (count > CHAT_DAILY_LIMIT) throw quotaError();
    memoryQuota.set(key, count);
    return;
  }

  const sql = neon(connStr);
  await ensureChatSchema(sql);
  const rows = (await sql`
    INSERT INTO basilisk_chat_usage (day, ip, count)
    VALUES (${day}::date, ${ip}, 1)
    ON CONFLICT (day, ip) DO UPDATE
      SET count = basilisk_chat_usage.count + 1
      WHERE basilisk_chat_usage.count < ${CHAT_DAILY_LIMIT}
    RETURNING count
  `) as Array<{ count: number }>;
  if (rows.length === 0) throw quotaError();
}
