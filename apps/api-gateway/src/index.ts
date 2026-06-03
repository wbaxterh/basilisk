/**
 * @basilisk/api-gateway
 * API gateway / BFF — auth, rate-limiting, caching, API keys, and the public Data API.
 *
 * Owns: EPIC-1 (US-1.3), EPIC-8 (US-8.1/8.2/8.3)
 * See docs/BASILISK_MVP_PLAN.md for the backing user stories.
 */

export const SERVICE = "api-gateway" as const;

export function describe(): string {
  return `[api-gateway] API gateway / BFF — auth, rate-limiting, caching, API keys, and the public Data API.`;
}

// TODO(US): implement per the MVP plan. This is a scaffold placeholder.
if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  // eslint-disable-next-line no-console
  console.log(describe());
}
