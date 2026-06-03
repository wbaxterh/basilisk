/**
 * @basilisk/pricing
 * DEX adapters + VWAP pricing + OHLCV candle engine + quality filter + token metadata.
 *
 * Owns: EPIC-0 (US-0.3, US-0.4, US-0.5, US-0.6, US-0.7)
 * See docs/BASILISK_MVP_PLAN.md for the backing user stories.
 */

export const SERVICE = "pricing" as const;

export function describe(): string {
  return `[pricing] DEX adapters + VWAP pricing + OHLCV candle engine + quality filter + token metadata.`;
}

// TODO(US): implement per the MVP plan. This is a scaffold placeholder.
if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  // eslint-disable-next-line no-console
  console.log(describe());
}
