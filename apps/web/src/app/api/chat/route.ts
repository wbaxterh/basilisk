/**
 * Ask Basilisk — /api/chat
 *
 * Streaming NDJSON chat endpoint: manual Anthropic tool-use loop over the
 * same data functions the MCP server exposes (see src/lib/chat.ts).
 *
 * Line protocol (one JSON object per line):
 *   {"type":"text","delta":"..."}          streamed answer text
 *   {"type":"tool","name":"...","label"}   a tool call started
 *   {"type":"error","message":"..."}       fatal mid-stream error
 *   {"type":"done"}                        end of turn
 */

import Anthropic from "@anthropic-ai/sdk";

import { ApiError } from "@/lib/dex-data";
import { checkChatQuota, executeTool, SYSTEM, TOOLS, TOOL_LABELS } from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGES = 12;
const MAX_CONTENT_CHARS = 2000;
const MAX_BODY_BYTES = 32 * 1024;
const MAX_TOOL_ROUNDS = 6;

interface ChatMessageIn {
  role: "user" | "assistant";
  content: string;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Validate the request body shape; returns null when invalid. */
function parseMessages(body: unknown): ChatMessageIn[] | null {
  if (typeof body !== "object" || body === null) return null;
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return null;
  }
  const out: ChatMessageIn[] = [];
  for (const m of messages) {
    if (typeof m !== "object" || m === null) return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || content.length === 0 || content.length > MAX_CONTENT_CHARS) {
      return null;
    }
    out.push({ role, content });
  }
  if (out[0]!.role !== "user") return null;
  if (out[out.length - 1]!.role !== "user") return null;
  return out;
}

function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError) {
    return "The assistant is busy — try again in a minute.";
  }
  if (err instanceof Anthropic.APIError) {
    return "The assistant hit a snag — try again shortly.";
  }
  return "Something went wrong — try again shortly.";
}

export async function POST(req: Request): Promise<Response> {
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return json(400, { error: "Unreadable request body" });
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return json(400, { error: "Request too large", hint: "Body must stay under 32kb." });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  // Key check BEFORE message validation so the ChatPanel health probe
  // (an intentionally-empty messages array) sees 503 when keyless — a 400
  // here would make the panel report "healthy" on a dead assistant.
  if (!process.env.ANTHROPIC_API_KEY) {
    return json(503, {
      error: "Chat is warming up",
      hint: "The assistant needs an API key configured.",
    });
  }

  const history = parseMessages(body);
  if (!history) {
    return json(400, {
      error: "Invalid messages",
      hint: `Expected 1-${MAX_MESSAGES} alternating {role, content} messages (content ≤ ${MAX_CONTENT_CHARS} chars), starting and ending with a user turn.`,
    });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  try {
    await checkChatQuota(ip);
  } catch (err) {
    if (err instanceof ApiError) {
      return json(err.status, { error: err.message, hint: err.hint ?? null });
    }
    return json(500, { error: "Quota check failed", hint: "Try again shortly." });
  }

  // Build the Anthropic message list LAST (after the cached tools+system
  // prefix): the volatile date context rides on the first user turn, never
  // in the frozen system prompt.
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const today = new Date().toISOString().slice(0, 10);
  messages[0] = {
    role: "user",
    content: `<context>today: ${today}</context>\n\n${history[0]!.content}`,
  };

  const client = new Anthropic();
  const model = process.env.BASILISK_CHAT_MODEL || "claude-opus-4-8";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };

      try {
        let toolRounds = 0;
        // Manual streaming tool loop (per Anthropic docs): stream text deltas,
        // collect the full message, execute tool_use blocks, feed tool_result
        // blocks back, repeat. After MAX_TOOL_ROUNDS the final pass keeps the
        // tool defs (history references them) but forbids further calls.
        while (true) {
          const finalPass = toolRounds >= MAX_TOOL_ROUNDS;
          const messageStream = client.messages.stream({
            model,
            max_tokens: 1024,
            thinking: { type: "adaptive" },
            // Tools render before system — keep both byte-stable so the
            // cache_control breakpoint below caches tools + system together.
            tools: TOOLS,
            ...(finalPass ? { tool_choice: { type: "none" as const } } : {}),
            system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
            messages,
          });

          messageStream.on("text", (delta) => write({ type: "text", delta }));

          const msg = await messageStream.finalMessage();

          if (msg.stop_reason === "refusal") {
            write({ type: "text", delta: "I can't help with that one." });
            break;
          }

          // Push the FULL content back (preserves thinking blocks — required
          // for multi-turn tool use on the same model).
          messages.push({ role: "assistant", content: msg.content });

          if (msg.stop_reason !== "tool_use" || finalPass) break;

          const toolUses = msg.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );
          if (toolUses.length === 0) break;

          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            write({
              type: "tool",
              name: tu.name,
              label: TOOL_LABELS[tu.name] ?? `Running ${tu.name}…`,
            });
            const exec = await executeTool(tu.name, tu.input);
            results.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: exec.text,
              ...(exec.isError ? { is_error: true } : {}),
            });
          }
          messages.push({ role: "user", content: results });
          toolRounds += 1;
        }

        write({ type: "done" });
      } catch (err) {
        try {
          write({ type: "error", message: friendlyError(err) });
        } catch {
          // stream already closed by the client — nothing left to say
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
