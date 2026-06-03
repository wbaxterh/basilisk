/**
 * @basilisk/shared
 * Shared TypeScript types, config loading, and utilities used across services.
 *
 * Owns: cross-cutting
 * See docs/BASILISK_MVP_PLAN.md for the backing user stories.
 */

export const SERVICE = "shared" as const;

export function describe(): string {
  return `[shared] Shared TypeScript types, config loading, and utilities used across services.`;
}

// TODO(US): implement per the MVP plan. This is a scaffold placeholder.
if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  // eslint-disable-next-line no-console
  console.log(describe());
}
