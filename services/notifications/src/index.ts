/**
 * @basilisk/notifications
 * Multi-channel delivery: in-app, web push, email (Resend/SES), Telegram & Discord.
 *
 * Owns: EPIC-7 (US-7.2)
 * See docs/BASILISK_MVP_PLAN.md for the backing user stories.
 */

export const SERVICE = "notifications" as const;

export function describe(): string {
  return `[notifications] Multi-channel delivery: in-app, web push, email (Resend/SES), Telegram & Discord.`;
}

// TODO(US): implement per the MVP plan. This is a scaffold placeholder.
if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  // eslint-disable-next-line no-console
  console.log(describe());
}
