/**
 * @basilisk/chain-data
 * Cardano data-access client lib: Demeter (Ogmios/Kupo/db-sync) primary + Blockfrost fallback w/ failover.
 *
 * Owns: EPIC-0 (US-0.1)
 * See docs/BASILISK_MVP_PLAN.md for the backing user stories.
 */

export const SERVICE = "chain-data" as const;

export function describe(): string {
  return `[chain-data] Cardano data-access client lib: Demeter (Ogmios/Kupo/db-sync) primary + Blockfrost fallback w/ failover.`;
}

// TODO(US): implement per the MVP plan. This is a scaffold placeholder.
if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  // eslint-disable-next-line no-console
  console.log(describe());
}
