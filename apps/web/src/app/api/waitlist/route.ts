import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SignupBody {
  email?: string;
  walletAddr?: string;
  referrer?: string;
}

let schemaReady = false;
async function ensureSchema(sql: ReturnType<typeof neon<false, false>>) {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS waitlist (
      id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email       TEXT        UNIQUE,
      wallet_addr TEXT,
      referrer    TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  schemaReady = true;
}

const ALERT_TO = "wesleybaxterhuber@gmail.com";
const ALERT_FROM = process.env.RESEND_FROM || "Basilisk <onboarding@resend.dev>";

async function sendAlert(
  resend: Resend,
  data: { email?: string; walletAddr?: string; position: number }
): Promise<void> {
  const who = data.email
    ? `Email: ${data.email}${data.walletAddr ? ` · Wallet: ${shortAddr(data.walletAddr)}` : ""}`
    : `Wallet only: ${shortAddr(data.walletAddr ?? "")}`;

  await resend.emails.send({
    from: ALERT_FROM,
    to: ALERT_TO,
    subject: `🟢 New Basilisk signup · #${data.position}`,
    text:
      `New Basilisk waitlist signup.\n\n` +
      `Position: #${data.position}\n` +
      `${who}\n` +
      `Time: ${new Date().toISOString()}\n`,
  });
}

function shortAddr(addr: string): string {
  if (!addr) return "";
  if (addr.length <= 18) return addr;
  return `${addr.slice(0, 10)}…${addr.slice(-8)}`;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: Request) {
  let body: SignupBody;
  try {
    body = (await req.json()) as SignupBody;
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const email = body.email?.trim() || undefined;
  const walletAddr = body.walletAddr?.trim() || undefined;
  const referrer = body.referrer?.trim() || undefined;

  if (!email && !walletAddr) {
    return NextResponse.json(
      { error: { code: "MISSING_FIELD", message: "email or walletAddr is required" } },
      { status: 400 }
    );
  }

  if (email && !isValidEmail(email)) {
    return NextResponse.json(
      { error: { code: "INVALID_EMAIL", message: "Invalid email address" } },
      { status: 400 }
    );
  }

  const connStr =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL;

  if (!connStr) {
    // No DB configured yet — degrade gracefully and at least fire the email
    // alert if we have one. Useful during initial setup.
    console.warn("[waitlist] DATABASE_URL not set — skipping DB insert");
    await tryEmailOnly(email, walletAddr);
    return NextResponse.json({ data: { success: true, position: 0 } }, { status: 201 });
  }

  try {
    const sql = neon(connStr);
    await ensureSchema(sql);

    // Insert. Use ON CONFLICT so re-submitting the same email is idempotent;
    // the row's wallet_addr is updated if a wallet was attached this time.
    await sql`
      INSERT INTO waitlist (email, wallet_addr, referrer)
      VALUES (${email ?? null}, ${walletAddr ?? null}, ${referrer ?? null})
      ON CONFLICT (email) DO UPDATE
      SET wallet_addr = COALESCE(EXCLUDED.wallet_addr, waitlist.wallet_addr)
    `;

    const countRows = (await sql`SELECT COUNT(*)::int AS count FROM waitlist`) as Array<{ count: number }>;
    const position = countRows[0]?.count ?? 0;

    // Fire email alert (best-effort — failure shouldn't break the signup).
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await sendAlert(resend, { email, walletAddr, position });
      } catch (e) {
        console.error("[waitlist] email alert failed:", e);
      }
    }

    return NextResponse.json({ data: { success: true, position } }, { status: 201 });
  } catch (e) {
    console.error("[waitlist] signup failed:", e);
    return NextResponse.json(
      { error: { code: "SIGNUP_FAILED", message: "Could not process signup" } },
      { status: 500 }
    );
  }
}

async function tryEmailOnly(email?: string, walletAddr?: string) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await sendAlert(resend, { email, walletAddr, position: 0 });
  } catch (e) {
    console.error("[waitlist] email-only alert failed:", e);
  }
}

export async function GET() {
  const connStr =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL;

  if (!connStr) {
    return NextResponse.json({ data: { count: 0, configured: false } });
  }

  try {
    const sql = neon(connStr);
    await ensureSchema(sql);
    const rows = (await sql`SELECT COUNT(*)::int AS count FROM waitlist`) as Array<{ count: number }>;
    return NextResponse.json({ data: { count: rows[0]?.count ?? 0, configured: true } });
  } catch {
    return NextResponse.json({ data: { count: 0, configured: true } });
  }
}
