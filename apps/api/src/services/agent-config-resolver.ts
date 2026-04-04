import type { ResolvedAgentConfig, PipelineStage } from "@optio/shared";
import type { RepoRecord } from "./repo-service.js";

/**
 * Resolve agent configuration for a task.
 *
 * Priority chain:
 * 1. Task has explicit agentId → load that agent's config
 * 2. Repo has a pipeline stage matching this task type → use stage's agent
 * 3. Fallback → build config from repo settings (backward compat)
 */
export async function resolveAgentConfig(
  taskType: string, // "coding" | "review" | "qa" | custom
  repoConfig: RepoRecord | null,
  opts?: {
    /** Explicit agent ID from the task record */
    agentId?: string | null;
    /** Pipeline stages for the repo (pre-loaded to avoid extra queries) */
    pipelineStages?: PipelineStage[];
    /** Review override model (from review-service) */
    reviewModelOverride?: string;
  },
): Promise<ResolvedAgentConfig> {
  // 1. Explicit agent ID → load from DB
  const explicitAgentId = opts?.agentId;
  if (explicitAgentId) {
    const agentConfig = await loadAgentConfig(explicitAgentId);
    if (agentConfig) return agentConfig;
    // Agent was deleted; fall through to pipeline/repo
  }

  // 2. Check pipeline stages for matching stage
  const stages = opts?.pipelineStages;
  if (stages && stages.length > 0) {
    const matchingStage = stages.find((s) => s.stage === taskType && s.enabled && s.agentId);
    if (matchingStage?.agentId) {
      const agentConfig = await loadAgentConfig(matchingStage.agentId);
      if (agentConfig) return agentConfig;
    }
  }

  // 3. Fallback: build from repo config
  return buildFromRepoConfig(taskType, repoConfig, opts?.reviewModelOverride);
}

/**
 * Load an agent profile and convert to ResolvedAgentConfig.
 *
 * When an agent is resolved, its config is AUTHORITATIVE — null fields mean
 * "use system defaults", NOT "inherit from repo". The agent is a self-contained
 * unit that fully defines the AI behavior. The repo only provides the execution
 * environment (image, base packages).
 */
async function loadAgentConfig(agentId: string): Promise<ResolvedAgentConfig | null> {
  const { getAgent } = await import("./agent-service.js");
  const agent = await getAgent(agentId);
  if (!agent) return null;

  return {
    agentId: agent.id,
    agentType: agent.agentType,
    // All fields are from the agent only — no repo fallback.
    // undefined = not set by agent → task-worker uses system defaults.
    model: agent.model ?? undefined,
    contextWindow: agent.contextWindow ?? undefined,
    thinking: agent.thinking ?? undefined,
    effort: agent.effort ?? undefined,
    // Image is NOT set from agent — repo owns the execution environment.
    // Agent's extraPackages/setupCommands are additive on top of repo's.
    extraPackages: agent.extraPackages ?? undefined,
    setupCommands: agent.setupCommands ?? undefined,
    maxTurns: agent.maxTurns ?? undefined,
    promptTemplate: agent.promptTemplate ?? undefined,
  };
}

/**
 * Build a ResolvedAgentConfig from legacy repo config fields.
 * This preserves 100% backward compatibility for repos without pipeline stages.
 */
function buildFromRepoConfig(
  taskType: string,
  repoConfig: RepoRecord | null,
  reviewModelOverride?: string,
): ResolvedAgentConfig {
  if (!repoConfig) {
    return { agentType: "claude-code" };
  }

  const isReview = taskType === "review" || taskType === "pr_review";

  // Repo fallback: no agent resolved, build config from repo fields (backward compat)
  return {
    agentType: repoConfig.defaultAgentType ?? "claude-code",
    model: isReview
      ? (reviewModelOverride ?? repoConfig.reviewModel ?? "sonnet")
      : (repoConfig.claudeModel ?? undefined),
    contextWindow: repoConfig.claudeContextWindow ?? undefined,
    thinking: repoConfig.claudeThinking ?? undefined,
    effort: repoConfig.claudeEffort ?? undefined,
    maxTurns: isReview
      ? (repoConfig.maxTurnsReview ?? undefined)
      : (repoConfig.maxTurnsCoding ?? undefined),
    promptTemplate: repoConfig.promptTemplateOverride ?? undefined,
  };
}
