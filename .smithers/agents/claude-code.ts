import { ClaudeCodeAgent as SmithersClaudeCodeAgent } from "smithers-orchestrator";

// Built-in Claude Code CLI agent (cliEngine: "claude-code").
export const ClaudeCodeAgent = new SmithersClaudeCodeAgent({
  model: "claude-opus-4-6",
  cwd: process.cwd(),
  // systemPrompt: "Add shared instructions for every Claude run.",
  // timeoutMs: 10 * 60 * 1000,
  // dangerouslySkipPermissions: true,
});
