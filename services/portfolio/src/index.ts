/**
 * @basilisk/portfolio
 * Resolves UTxOs to holdings, marks to market, computes P&L; powers portfolio + wallet profiler.
 *
 * Owns: EPIC-2, EPIC-5, EPIC-6
 * See docs/BASILISK_MVP_PLAN.md for the backing user stories.
 */

export const SERVICE = "portfolio" as const;

export function describe(): string {
  return `[portfolio] Resolves UTxOs to holdings, marks to market, computes P&L; powers portfolio + wallet profiler.`;
}

// TODO(US): implement per the MVP plan. This is a scaffold placeholder.
if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  // eslint-disable-next-line no-console
  console.log(describe());
}
