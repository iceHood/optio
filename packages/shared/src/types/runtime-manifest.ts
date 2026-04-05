// ── Runtime Manifest: Declarative environment specification ─────────────────
//
// Replaces the static image preset system with manifest-based composition.
// Repo owns the environment, Agent is environment-independent,
// Skills/MCPs declare their own dependencies.
// The platform merges everything into a resolved runtime spec.

/** A supported language runtime that can be installed in a pod. */
export type RuntimeLanguage = "node" | "python" | "go" | "rust";

/** A language requirement with optional version and tooling. */
export interface LanguageRequirement {
  name: RuntimeLanguage;
  /** Semver-ish version: "20", "3.11", "1.23". Omit for image default. */
  version?: string;
  /** Extra tooling: ["pnpm", "uv", "poetry", "cargo-nextest"] */
  tools?: string[];
}

/** Abstract capabilities that require special pod configuration. */
export type RuntimeCapability = "docker" | "gpu" | "browser";

/**
 * Declarative environment specification.
 *
 * Used by repos (full environment), agents (additive deps),
 * MCP servers (required deps), and skills (required deps).
 */
export interface RuntimeManifest {
  languages?: LanguageRequirement[];
  /** apt packages */
  systemPackages?: string[];
  /** Global npm packages */
  nodePackages?: string[];
  /** pip packages */
  pythonPackages?: string[];
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Ordered shell commands (escape hatch for anything not covered above) */
  setup?: string[];
  /** Special capabilities requiring pod-level config */
  capabilities?: RuntimeCapability[];
}

/** A manifest tagged with its source for merge attribution and auditing. */
export interface TaggedManifest {
  source: "repo" | "agent" | "mcp" | "skill";
  sourceName: string;
  manifest: RuntimeManifest;
}

/** What needs to be installed beyond what the image already provides. */
export interface InstallPlan {
  systemPackages: string[];
  nodePackages: string[];
  pythonPackages: string[];
  envVars: Record<string, string>;
  setupCommands: string[];
  /** Language toolchains that need runtime installation (not in the image). */
  languageInstalls: LanguageRequirement[];
}

/** A detected conflict during manifest merge. */
export interface RuntimeConflict {
  field: string;
  sources: Array<{ name: string; value: string }>;
  resolution: string;
}

/** The output of the runtime resolver. */
export interface ResolvedRuntime {
  /** Final merged manifest (all sources combined). */
  merged: RuntimeManifest;
  /** SHA-256 hash of the canonical merged manifest (cache key). */
  hash: string;
  /** Selected container image tag. */
  image: string;
  /** What to install at pod startup (repo-level deps — shared across tasks). */
  podInstallPlan: InstallPlan;
  /** What to install per-task (agent/skill/mcp deps — varies per task). */
  taskInstallPlan: InstallPlan;
  /** All source manifests for audit trail. */
  sources: TaggedManifest[];
  /** Detected conflicts and how they were resolved. */
  conflicts: RuntimeConflict[];
}
