export type ClaudeAuthMode = "api-key" | "max-subscription" | "claude-cli";
export type CodexAuthMode = "api-key" | "app-server";
export type CopilotAuthMode = "github-token";

export interface AgentTaskInput {
  taskId: string;
  prompt: string;
  repoUrl: string;
  repoBranch: string;
  additionalContext?: string;
  claudeAuthMode?: ClaudeAuthMode;
  codexAuthMode?: CodexAuthMode;
  /** The app-server WebSocket URL for Codex CLI (used when codexAuthMode is "app-server") */
  codexAppServerUrl?: string;
  copilotAuthMode?: CopilotAuthMode;
  optioApiUrl?: string; // for apiKeyHelper callback
  /** The rendered system prompt (from the prompt template) */
  renderedPrompt?: string;
  /** The task file content to write into the worktree */
  taskFileContent?: string;
  /** Path for the task file inside the worktree */
  taskFilePath?: string;
  claudeModel?: string;
  claudeContextWindow?: string;
  claudeThinking?: boolean;
  claudeEffort?: string;
  copilotModel?: string;
  copilotEffort?: string;
}

export interface AgentContainerConfig {
  command: string[];
  env: Record<string, string>;
  requiredSecrets: string[];
  image?: string;
  /** Files to create inside the container before running the agent */
  setupFiles?: Array<{ path: string; content: string; executable?: boolean }>;
}

export interface AgentResult {
  success: boolean;
  prUrl?: string;
  summary?: string;
  error?: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}

export interface AgentConfig {
  id: string;
  type: string;
  displayName: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ── Agent-centric pipeline types ──────────────────────────────────────────

/** A reusable agent configuration bundle */
export interface AgentProfile {
  id: string;
  name: string;
  description?: string | null;
  agentType: string; // "claude-code" | "codex" | "copilot"
  model?: string | null;
  contextWindow?: string | null;
  thinking?: boolean | null;
  effort?: string | null;
  /** @deprecated Use runtimeRequires instead. Agent should be environment-independent. */
  imagePreset?: string | null;
  /** @deprecated Use runtimeRequires instead. */
  customDockerfile?: string | null;
  /** @deprecated Use runtimeRequires.systemPackages instead. */
  extraPackages?: string | null;
  /** @deprecated Use runtimeRequires.setup instead. */
  setupCommands?: string | null;
  /** Declarative runtime dependencies (packages, tools the agent's skills/MCPs need). */
  runtimeRequires?: import("./runtime-manifest.js").RuntimeManifest | null;
  maxTurns?: number | null;
  promptTemplate?: string | null;
  workspaceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  agentType?: string;
  model?: string;
  contextWindow?: string;
  thinking?: boolean;
  effort?: string;
  /** @deprecated Use runtimeRequires instead. */
  imagePreset?: string;
  /** @deprecated Use runtimeRequires instead. */
  customDockerfile?: string;
  /** @deprecated Use runtimeRequires.systemPackages instead. */
  extraPackages?: string;
  /** @deprecated Use runtimeRequires.setup instead. */
  setupCommands?: string;
  /** Declarative runtime dependencies. */
  runtimeRequires?: import("./runtime-manifest.js").RuntimeManifest;
  maxTurns?: number;
  promptTemplate?: string;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string | null;
  agentType?: string;
  model?: string | null;
  contextWindow?: string | null;
  thinking?: boolean | null;
  effort?: string | null;
  /** @deprecated Use runtimeRequires instead. */
  imagePreset?: string | null;
  /** @deprecated Use runtimeRequires instead. */
  customDockerfile?: string | null;
  /** @deprecated Use runtimeRequires.systemPackages instead. */
  extraPackages?: string | null;
  /** @deprecated Use runtimeRequires.setup instead. */
  setupCommands?: string | null;
  /** Declarative runtime dependencies. */
  runtimeRequires?: import("./runtime-manifest.js").RuntimeManifest | null;
  maxTurns?: number | null;
  promptTemplate?: string | null;
}

/** Resolved agent config used at task execution time.
 *
 * When agentId is set, the agent is the authoritative source for AI behavior.
 * Image/environment comes from the repo, not the agent.
 */
export interface ResolvedAgentConfig {
  agentId?: string;
  agentType: string;
  model?: string;
  contextWindow?: string;
  thinking?: boolean;
  effort?: string;
  // No imagePreset — repo owns the execution environment.
  /** @deprecated Use runtimeRequires instead. */
  extraPackages?: string;
  /** @deprecated Use runtimeRequires.setup instead. */
  setupCommands?: string;
  /** Declarative runtime dependencies from this agent (additive with repo manifest). */
  runtimeRequires?: import("./runtime-manifest.js").RuntimeManifest;
  maxTurns?: number;
  promptTemplate?: string;
}

/** A pipeline stage assigned to a repo */
export interface PipelineStage {
  id: string;
  repoId: string;
  stage: string; // "coding" | "review" | "qa" | custom
  stageOrder: number;
  agentId?: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineStageInput {
  stage: string;
  stageOrder: number;
  agentId?: string | null;
  enabled?: boolean;
}
