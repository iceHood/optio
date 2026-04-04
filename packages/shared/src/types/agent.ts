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
  imagePreset?: string | null;
  customDockerfile?: string | null;
  extraPackages?: string | null;
  setupCommands?: string | null;
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
  imagePreset?: string;
  customDockerfile?: string;
  extraPackages?: string;
  setupCommands?: string;
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
  imagePreset?: string | null;
  customDockerfile?: string | null;
  extraPackages?: string | null;
  setupCommands?: string | null;
  maxTurns?: number | null;
  promptTemplate?: string | null;
}

/** Resolved agent config used at task execution time */
export interface ResolvedAgentConfig {
  agentId?: string;
  agentType: string;
  model?: string;
  contextWindow?: string;
  thinking?: boolean;
  effort?: string;
  imagePreset?: string;
  customDockerfile?: string;
  extraPackages?: string;
  setupCommands?: string;
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
