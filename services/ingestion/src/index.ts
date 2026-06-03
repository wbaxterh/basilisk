/**
 * @basilisk/ingestion
 * Chain follower — tails Ogmios/Oura, normalizes events, publishes to Redis, persists swaps.
 *
 * Owns: EPIC-0 (US-0.1, US-0.2)
 * See docs/BASILISK_MVP_PLAN.md for the backing user stories.
 */

export const SERVICE = "ingestion" as const;

export function describe(): string {
  return `[ingestion] Chain follower — tails Ogmios/Oura, normalizes events, publishes to Redis, persists swaps.`;
}

// TODO(US): implement per the MVP plan. This is a scaffold placeholder.
if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  // eslint-disable-next-line no-console
  console.log(describe());
}
