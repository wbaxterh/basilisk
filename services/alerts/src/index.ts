/**
 * @basilisk/alerts
 * Alert rules engine evaluating the live event stream (price, %move, whale, balance, new LP).
 *
 * Owns: EPIC-7 (US-7.1, US-7.4)
 * See docs/BASILISK_MVP_PLAN.md for the backing user stories.
 */

export const SERVICE = "alerts" as const;

export function describe(): string {
  return `[alerts] Alert rules engine evaluating the live event stream (price, %move, whale, balance, new LP).`;
}

// TODO(US): implement per the MVP plan. This is a scaffold placeholder.
if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  // eslint-disable-next-line no-console
  console.log(describe());
}
