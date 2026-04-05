export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string> | null;
  installCommand?: string | null;
  /** Declarative runtime dependencies this MCP server needs. */
  requires?: import("./runtime-manifest.js").RuntimeManifest | null;
  scope: string; // "global" or repo URL
  repoUrl?: string | null;
  workspaceId?: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMcpServerInput {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  installCommand?: string;
  repoUrl?: string;
  enabled?: boolean;
}

export interface UpdateMcpServerInput {
  name?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string> | null;
  installCommand?: string | null;
  enabled?: boolean;
}

export interface CustomSkillConfig {
  id: string;
  name: string;
  description?: string | null;
  prompt: string;
  /** Declarative runtime dependencies this skill needs. */
  requires?: import("./runtime-manifest.js").RuntimeManifest | null;
  scope: string; // "global" or repo URL
  repoUrl?: string | null;
  workspaceId?: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomSkillInput {
  name: string;
  description?: string;
  prompt: string;
  repoUrl?: string;
  enabled?: boolean;
}

export interface UpdateCustomSkillInput {
  name?: string;
  description?: string | null;
  prompt?: string;
  enabled?: boolean;
}

// ── Marketplace Skills ──────────────────────────────────────────────────────

export interface MarketplaceSkillConfig {
  id: string;
  source: string; // "owner/repo" or "owner/repo@skill-name"
  skillPath: string;
  name: string;
  description?: string | null;
  prompt: string;
  referenceFiles?: Array<{ path: string; content: string }> | null;
  installs?: number | null;
  installed?: boolean;
  sourceCommit?: string | null;
  lastSyncedAt?: Date | null;
  workspaceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Skill Sets ──────────────────────────────────────────────────────────────

export interface SkillSetConfig {
  id: string;
  name: string;
  description?: string | null;
  scope: string;
  workspaceId?: string | null;
  items?: SkillSetItemConfig[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillSetItemConfig {
  id: string;
  skillSetId: string;
  skillType: "custom" | "marketplace";
  skillId: string;
  skillName?: string; // populated via join
  skillDescription?: string | null;
  createdAt: Date;
}
