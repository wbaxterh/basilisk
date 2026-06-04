/**
 * DEX adapter registry.
 * All supported DEX adapters are registered here.
 */

export type { DexAdapter } from "./adapter.js";
export { MinswapAdapter } from "./minswap.js";

import type { DexAdapter } from "./adapter.js";
import { MinswapAdapter } from "./minswap.js";

/** Create all supported DEX adapters. */
export function createAdapters(): DexAdapter[] {
  return [
    new MinswapAdapter(),
    // Add more as we implement them:
    // new SundaeswapAdapter(),
    // new WingridersAdapter(),
  ];
}
