import { createHash } from "node:crypto";
import { PRESET_IMAGES, type PresetImageId } from "./types/image.js";
import { DEFAULT_AGENT_IMAGE } from "./constants.js";
import type {
  RuntimeManifest,
  LanguageRequirement,
  RuntimeCapability,
  TaggedManifest,
  ResolvedRuntime,
  InstallPlan,
  RuntimeConflict,
} from "./types/runtime-manifest.js";

// ── Merge ───────────────────────────────────────────────────────────────────

/**
 * Merge multiple tagged manifests into a single RuntimeManifest.
 * - Languages: union by name, highest version wins.
 * - Tools: union per language.
 * - Packages: deduplicated union.
 * - Env: merge, conflict if same key different value.
 * - Setup: ordered by source priority (repo → agent → mcp → skill).
 * - Capabilities: union.
 */
export function mergeManifests(tagged: TaggedManifest[]): {
  merged: RuntimeManifest;
  conflicts: RuntimeConflict[];
} {
  const conflicts: RuntimeConflict[] = [];
  const languageMap = new Map<string, { req: LanguageRequirement; sources: string[] }>();
  const systemPkgs = new Set<string>();
  const nodePkgs = new Set<string>();
  const pythonPkgs = new Set<string>();
  const envMap = new Map<string, { value: string; source: string }>();
  const envMerged: Record<string, string> = {};
  const setupCommands: string[] = [];
  const capabilities = new Set<RuntimeCapability>();

  const sourcePriority: TaggedManifest["source"][] = ["repo", "agent", "mcp", "skill"];
  const sorted = [...tagged].sort(
    (a, b) => sourcePriority.indexOf(a.source) - sourcePriority.indexOf(b.source),
  );

  for (const { sourceName, manifest } of sorted) {
    // Languages
    for (const lang of manifest.languages ?? []) {
      const existing = languageMap.get(lang.name);
      if (existing) {
        // Higher version wins
        if (
          lang.version &&
          (!existing.req.version || compareVersions(lang.version, existing.req.version) > 0)
        ) {
          existing.req.version = lang.version;
        }
        // Union tools
        if (lang.tools) {
          const toolSet = new Set(existing.req.tools ?? []);
          for (const t of lang.tools) toolSet.add(t);
          existing.req.tools = [...toolSet];
        }
        existing.sources.push(sourceName);
      } else {
        languageMap.set(lang.name, {
          req: { ...lang, tools: lang.tools ? [...lang.tools] : undefined },
          sources: [sourceName],
        });
      }
    }

    // Packages (deduplicated union)
    for (const pkg of manifest.systemPackages ?? []) systemPkgs.add(pkg);
    for (const pkg of manifest.nodePackages ?? []) nodePkgs.add(pkg);
    for (const pkg of manifest.pythonPackages ?? []) pythonPkgs.add(pkg);

    // Env vars (conflict on same key, different value)
    for (const [key, value] of Object.entries(manifest.env ?? {})) {
      const existing = envMap.get(key);
      if (existing && existing.value !== value) {
        conflicts.push({
          field: `env.${key}`,
          sources: [
            { name: existing.source, value: existing.value },
            { name: sourceName, value },
          ],
          resolution: `Kept value from ${existing.source} (higher priority)`,
        });
      } else if (!existing) {
        envMap.set(key, { value, source: sourceName });
        envMerged[key] = value;
      }
    }

    // Setup commands (ordered by source priority)
    for (const cmd of manifest.setup ?? []) {
      setupCommands.push(cmd);
    }

    // Capabilities (union)
    for (const cap of manifest.capabilities ?? []) capabilities.add(cap);
  }

  const merged: RuntimeManifest = {};

  const languages = [...languageMap.values()].map((v) => v.req);
  if (languages.length > 0) merged.languages = languages;
  if (systemPkgs.size > 0) merged.systemPackages = [...systemPkgs].sort();
  if (nodePkgs.size > 0) merged.nodePackages = [...nodePkgs].sort();
  if (pythonPkgs.size > 0) merged.pythonPackages = [...pythonPkgs].sort();
  if (Object.keys(envMerged).length > 0) merged.env = envMerged;
  if (setupCommands.length > 0) merged.setup = setupCommands;
  if (capabilities.size > 0) merged.capabilities = [...capabilities].sort() as RuntimeCapability[];

  return { merged, conflicts };
}

// ── Image Selection ─────────────────────────────────────────────────────────

/**
 * Always use the base image. Languages, packages, and tools are installed
 * dynamically at runtime via the manifest provisioning system:
 * - Pod-level: repo-init.sh reads OPTIO_RUNTIME_MANIFEST
 * - Task-level: exec script reads OPTIO_TASK_RUNTIME
 *
 * There are NO static preset images required. The base image (Ubuntu + git +
 * Node.js + Python 3 + Claude Code) is the only image needed. Everything
 * else is composed at runtime from the merged manifest.
 */
export function selectImage(_merged: RuntimeManifest): { image: string; preset: PresetImageId } {
  return { image: PRESET_IMAGES.base.tag, preset: "base" };
}

// ── Install Plan ────────────────────────────────────────────────────────────

/**
 * Compute what needs to be installed beyond what the image already provides.
 */
export function computeInstallPlan(
  needed: RuntimeManifest,
  imageProvides: RuntimeManifest,
): InstallPlan {
  const providedLangs = new Map((imageProvides.languages ?? []).map((l) => [l.name, l]));
  const providedPkgs = new Set(imageProvides.systemPackages ?? []);

  // Languages that need runtime install
  const languageInstalls: LanguageRequirement[] = [];
  for (const lang of needed.languages ?? []) {
    const provided = providedLangs.get(lang.name);
    if (!provided) {
      // Language not in image at all — needs full install
      languageInstalls.push(lang);
    } else {
      // Language exists — check if any tools are missing
      const providedTools = new Set(provided.tools ?? []);
      const missingTools = (lang.tools ?? []).filter((t) => !providedTools.has(t));
      if (missingTools.length > 0) {
        languageInstalls.push({ name: lang.name, tools: missingTools });
      }
    }
  }

  // System packages not already in image
  const systemPackages = (needed.systemPackages ?? []).filter((p) => !providedPkgs.has(p));

  return {
    systemPackages,
    nodePackages: needed.nodePackages ?? [],
    pythonPackages: needed.pythonPackages ?? [],
    envVars: needed.env ?? {},
    setupCommands: needed.setup ?? [],
    languageInstalls,
  };
}

// ── Tier Splitting ──────────────────────────────────────────────────────────

/**
 * Split tagged manifests into pod-level (repo) and task-level (agent/mcp/skill).
 *
 * Pod-level deps are installed once at pod startup (shared across tasks).
 * Task-level deps are installed per-task exec (vary per agent).
 */
export function splitByTier(tagged: TaggedManifest[]): {
  pod: TaggedManifest[];
  task: TaggedManifest[];
} {
  const pod: TaggedManifest[] = [];
  const task: TaggedManifest[] = [];
  for (const t of tagged) {
    if (t.source === "repo") {
      pod.push(t);
    } else {
      task.push(t);
    }
  }
  return { pod, task };
}

// ── Hash ────────────────────────────────────────────────────────────────────

/**
 * Compute a stable SHA-256 hash of a RuntimeManifest.
 * Uses deep canonical JSON (recursively sorted keys) for determinism.
 */
export function computeRuntimeHash(manifest: RuntimeManifest): string {
  const canonical = JSON.stringify(canonicalize(manifest));
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

/** Deep-sort object keys for deterministic JSON serialization. */
function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

// ── Full Resolution ─────────────────────────────────────────────────────────

/**
 * Resolve a complete runtime from multiple tagged manifests.
 *
 * This is the main entry point for the runtime composition system.
 */
export function resolveRuntime(tagged: TaggedManifest[]): ResolvedRuntime {
  // 1. Split by tier
  const { pod: podManifests, task: taskManifests } = splitByTier(tagged);

  // 2. Merge all manifests for image selection
  const { merged, conflicts } = mergeManifests(tagged);

  // 3. Select optimal image
  const { image, preset } = selectImage(merged);
  const imageProvides: RuntimeManifest = PRESET_IMAGES[preset].provides;

  // 4. Compute pod-level install plan (repo deps beyond image)
  const { merged: podMerged } = mergeManifests(podManifests);
  const podInstallPlan = computeInstallPlan(podMerged, imageProvides);

  // 5. Compute task-level install plan (agent/skill/mcp deps beyond image + pod)
  const { merged: taskMerged } = mergeManifests(taskManifests);
  // Task installs are on top of image + pod, so subtract both
  const podPlusImage: RuntimeManifest = {
    ...imageProvides,
    systemPackages: [...(imageProvides.systemPackages ?? []), ...podInstallPlan.systemPackages],
    nodePackages: [...(imageProvides.nodePackages ?? []), ...podInstallPlan.nodePackages],
    pythonPackages: [...(imageProvides.pythonPackages ?? []), ...podInstallPlan.pythonPackages],
  };
  const taskInstallPlan = computeInstallPlan(taskMerged, podPlusImage);

  // 6. Compute hash for caching
  const hash = computeRuntimeHash(merged);

  return {
    merged,
    hash,
    image,
    podInstallPlan,
    taskInstallPlan,
    sources: tagged,
    conflicts,
  };
}

// ── Legacy Synthesis ────────────────────────────────────────────────────────

/**
 * Synthesize a RuntimeManifest from legacy imagePreset + extraPackages fields.
 * Used for backward compatibility during migration.
 */
export function synthesizeFromLegacy(
  imagePreset?: string | null,
  extraPackages?: string | null,
  setupCommands?: string | null,
): RuntimeManifest {
  const manifest: RuntimeManifest = {};

  // Map old imagePreset to language requirements
  if (imagePreset && imagePreset in PRESET_IMAGES) {
    const preset = PRESET_IMAGES[imagePreset as PresetImageId];
    // Use the preset's language list (the old-style string array)
    const langSet = new Set<string>();
    for (const l of preset.languages) {
      // Map "javascript"/"typescript" → "node"
      if (l === "javascript" || l === "typescript") langSet.add("node");
      else langSet.add(l);
    }
    if (langSet.size > 0) {
      manifest.languages = [...langSet].map((name) => ({
        name: name as LanguageRequirement["name"],
      }));
    }
  }

  // Parse comma/space-separated extraPackages
  if (extraPackages) {
    const pkgs = extraPackages
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (pkgs.length > 0) manifest.systemPackages = pkgs;
  }

  // Parse setupCommands
  if (setupCommands) {
    const cmds = setupCommands
      .split(/\s*&&\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (cmds.length > 0) manifest.setup = cmds;
  }

  return manifest;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Simple version comparison: "3.11" > "3.9", "22" > "20". */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

/** Check if an install plan has any work to do. */
export function isEmptyInstallPlan(plan: InstallPlan): boolean {
  return (
    plan.systemPackages.length === 0 &&
    plan.nodePackages.length === 0 &&
    plan.pythonPackages.length === 0 &&
    plan.setupCommands.length === 0 &&
    plan.languageInstalls.length === 0 &&
    Object.keys(plan.envVars).length === 0
  );
}
