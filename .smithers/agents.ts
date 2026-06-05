// smithers-source: generated
import { type AgentLike, ClaudeCodeAgent as SmithersClaudeCodeAgent } from "smithers-orchestrator";
import { ClaudeCodeAgent } from "./agents/claude-code";

export { ClaudeCodeAgent } from "./agents/claude-code";

export const providers = {
  claude: ClaudeCodeAgent,
  claudeSonnet: new SmithersClaudeCodeAgent({ model: "claude-sonnet-4-7", cwd: process.cwd() }),
} as const;

export const agents = {
  // cheapFast: Smithers would normally suggest Kimi here, but Kimi is not available: missing `kimi` on PATH; missing credentials (~/.kimi).
  cheapFast: [providers.claudeSonnet],
  // smart: Smithers would normally suggest Codex here, but Codex is not available: missing `codex` on PATH.
  // smart: Smithers would normally suggest OpenCode here, but OpenCode is not available: missing `opencode` on PATH; missing credentials (~/.local/share/opencode/auth.json or ~/.config/opencode or ~/.local/share/opencode or $OPENCODE_API_KEY or $ANTHROPIC_API_KEY or $OPENAI_API_KEY or $GEMINI_API_KEY or $GOOGLE_API_KEY).
  smart: [providers.claude],
  smartTool: [providers.claude],
} as const satisfies Record<string, AgentLike[]>;
