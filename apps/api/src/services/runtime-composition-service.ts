import type {
  RuntimeManifest,
  TaggedManifest,
  ResolvedRuntime,
  ResolvedAgentConfig,
  McpServerConfig,
  CustomSkillConfig,
} from "@optio/shared";
import { resolveRuntime, synthesizeFromLegacy } from "@optio/shared/runtime-resolver";
import type { RepoRecord } from "./repo-service.js";

/**
 * Compose a complete runtime from repo config, agent config, and MCP/skill lists.
 *
 * This is the DB-aware orchestrator: it reads manifests from all sources,
 * applies legacy fallback synthesis where needed, and delegates to the
 * pure-function resolver in @optio/shared.
 */
export function composeRuntime(
  repoConfig: RepoRecord | null,
  agentConfig: ResolvedAgentConfig | null,
  mcpServers: McpServerConfig[],
  skills: CustomSkillConfig[],
): ResolvedRuntime {
  const tagged: TaggedManifest[] = [];

  // ── Repo manifest (or synthesize from legacy fields) ────────────────────
  if (repoConfig) {
    const repoManifest = repoConfig.runtimeManifest
      ? (repoConfig.runtimeManifest as RuntimeManifest)
      : synthesizeFromLegacy(
          repoConfig.imagePreset,
          repoConfig.extraPackages,
          repoConfig.setupCommands,
        );

    tagged.push({
      source: "repo",
      sourceName: repoConfig.fullName || repoConfig.repoUrl,
      manifest: repoManifest,
    });
  }

  // ── Agent manifest (or synthesize from legacy fields) ───────────────────
  if (agentConfig) {
    const agentManifest = agentConfig.runtimeRequires
      ? agentConfig.runtimeRequires
      : synthesizeFromLegacy(null, agentConfig.extraPackages, agentConfig.setupCommands);

    // Only add if the manifest has content
    if (Object.keys(agentManifest).length > 0) {
      tagged.push({
        source: "agent",
        sourceName: agentConfig.agentId ?? "default-agent",
        manifest: agentManifest,
      });
    }
  }

  // ── MCP server manifests ────────────────────────────────────────────────
  for (const mcp of mcpServers) {
    if (mcp.requires && Object.keys(mcp.requires).length > 0) {
      tagged.push({
        source: "mcp",
        sourceName: mcp.name,
        manifest: mcp.requires,
      });
    }
  }

  // ── Skill manifests ─────────────────────────────────────────────────────
  for (const skill of skills) {
    if (skill.requires && Object.keys(skill.requires).length > 0) {
      tagged.push({
        source: "skill",
        sourceName: skill.name,
        manifest: skill.requires,
      });
    }
  }

  return resolveRuntime(tagged);
}
