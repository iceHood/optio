import { describe, it, expect } from "vitest";
import {
  mergeManifests,
  selectImage,
  computeInstallPlan,
  splitByTier,
  computeRuntimeHash,
  resolveRuntime,
  synthesizeFromLegacy,
  compareVersions,
  isEmptyInstallPlan,
} from "./runtime-resolver.js";
import type { TaggedManifest, RuntimeManifest, InstallPlan } from "./types/runtime-manifest.js";

// ── compareVersions ─────────────────────────────────────────────────────────

describe("compareVersions", () => {
  it("compares major versions", () => {
    expect(compareVersions("22", "20")).toBeGreaterThan(0);
    expect(compareVersions("20", "22")).toBeLessThan(0);
    expect(compareVersions("20", "20")).toBe(0);
  });

  it("compares minor versions", () => {
    expect(compareVersions("3.11", "3.9")).toBeGreaterThan(0);
    expect(compareVersions("3.9", "3.11")).toBeLessThan(0);
  });

  it("handles different depths", () => {
    expect(compareVersions("3.11", "3")).toBeGreaterThan(0);
    expect(compareVersions("1.23", "1.23.0")).toBe(0);
  });
});

// ── mergeManifests ──────────────────────────────────────────────────────────

describe("mergeManifests", () => {
  it("merges empty manifests", () => {
    const { merged, conflicts } = mergeManifests([]);
    expect(merged).toEqual({});
    expect(conflicts).toEqual([]);
  });

  it("passes through a single manifest", () => {
    const tagged: TaggedManifest[] = [
      {
        source: "repo",
        sourceName: "my-repo",
        manifest: {
          languages: [{ name: "node", version: "20" }],
          systemPackages: ["ffmpeg"],
        },
      },
    ];
    const { merged } = mergeManifests(tagged);
    expect(merged.languages).toEqual([{ name: "node", version: "20" }]);
    expect(merged.systemPackages).toEqual(["ffmpeg"]);
  });

  it("unions languages by name, highest version wins", () => {
    const tagged: TaggedManifest[] = [
      {
        source: "repo",
        sourceName: "repo",
        manifest: { languages: [{ name: "python", version: "3.9" }] },
      },
      {
        source: "skill",
        sourceName: "ml-skill",
        manifest: { languages: [{ name: "python", version: "3.11" }] },
      },
    ];
    const { merged } = mergeManifests(tagged);
    expect(merged.languages).toHaveLength(1);
    expect(merged.languages![0].version).toBe("3.11");
  });

  it("unions tools for the same language", () => {
    const tagged: TaggedManifest[] = [
      {
        source: "repo",
        sourceName: "repo",
        manifest: { languages: [{ name: "python", tools: ["pip", "uv"] }] },
      },
      {
        source: "agent",
        sourceName: "agent",
        manifest: { languages: [{ name: "python", tools: ["poetry"] }] },
      },
    ];
    const { merged } = mergeManifests(tagged);
    expect(merged.languages![0].tools).toEqual(expect.arrayContaining(["pip", "uv", "poetry"]));
  });

  it("deduplicates system packages", () => {
    const tagged: TaggedManifest[] = [
      {
        source: "repo",
        sourceName: "repo",
        manifest: { systemPackages: ["ffmpeg", "jq"] },
      },
      {
        source: "mcp",
        sourceName: "video-mcp",
        manifest: { systemPackages: ["ffmpeg", "imagemagick"] },
      },
    ];
    const { merged } = mergeManifests(tagged);
    expect(merged.systemPackages).toEqual(["ffmpeg", "imagemagick", "jq"]);
  });

  it("detects env var conflicts", () => {
    const tagged: TaggedManifest[] = [
      {
        source: "repo",
        sourceName: "repo",
        manifest: { env: { PORT: "3000" } },
      },
      {
        source: "mcp",
        sourceName: "web-mcp",
        manifest: { env: { PORT: "8080" } },
      },
    ];
    const { merged, conflicts } = mergeManifests(tagged);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].field).toBe("env.PORT");
    // Repo wins (higher priority)
    expect(merged.env!.PORT).toBe("3000");
  });

  it("orders setup commands by source priority", () => {
    const tagged: TaggedManifest[] = [
      {
        source: "skill",
        sourceName: "skill-a",
        manifest: { setup: ["skill-setup"] },
      },
      {
        source: "repo",
        sourceName: "repo",
        manifest: { setup: ["repo-setup"] },
      },
      {
        source: "agent",
        sourceName: "agent",
        manifest: { setup: ["agent-setup"] },
      },
    ];
    const { merged } = mergeManifests(tagged);
    // Source priority: repo → agent → skill
    expect(merged.setup).toEqual(["repo-setup", "agent-setup", "skill-setup"]);
  });

  it("unions capabilities", () => {
    const tagged: TaggedManifest[] = [
      {
        source: "repo",
        sourceName: "repo",
        manifest: { capabilities: ["docker"] },
      },
      {
        source: "skill",
        sourceName: "e2e-skill",
        manifest: { capabilities: ["browser"] },
      },
    ];
    const { merged } = mergeManifests(tagged);
    expect(merged.capabilities).toEqual(["browser", "docker"]);
  });
});

// ── selectImage ─────────────────────────────────────────────────────────────

describe("selectImage", () => {
  it("selects base for empty manifest", () => {
    const { preset } = selectImage({});
    expect(preset).toBe("base");
  });

  it("selects node preset for node-only", () => {
    const { preset } = selectImage({ languages: [{ name: "node" }] });
    expect(preset).toBe("node");
  });

  it("selects python preset for python-only", () => {
    const { preset } = selectImage({ languages: [{ name: "python" }] });
    expect(preset).toBe("python");
  });

  it("selects go preset for go-only", () => {
    const { preset } = selectImage({ languages: [{ name: "go" }] });
    expect(preset).toBe("go");
  });

  it("selects rust preset for rust-only", () => {
    const { preset } = selectImage({ languages: [{ name: "rust" }] });
    expect(preset).toBe("rust");
  });

  it("selects full for multi-language", () => {
    const { preset } = selectImage({
      languages: [{ name: "node" }, { name: "python" }, { name: "go" }],
    });
    expect(preset).toBe("full");
  });

  it("selects full for node + rust (no single preset covers both)", () => {
    const { preset } = selectImage({
      languages: [{ name: "node" }, { name: "rust" }],
    });
    expect(preset).toBe("full");
  });

  it("selects dind when docker capability needed and no language", () => {
    const { preset } = selectImage({ capabilities: ["docker"] });
    // dind or base+docker — dind is more specific
    expect(["dind", "full"]).toContain(preset);
  });

  it("prefers leaner image when multiple cover requirements", () => {
    // node-only: both "node" and "full" cover it, but "node" is leaner
    const { preset } = selectImage({ languages: [{ name: "node" }] });
    expect(preset).toBe("node");
  });
});

// ── computeInstallPlan ──────────────────────────────────────────────────────

describe("computeInstallPlan", () => {
  it("returns empty plan when image covers everything", () => {
    const needed: RuntimeManifest = {
      languages: [{ name: "node" }],
      systemPackages: ["build-essential"],
    };
    const provides: RuntimeManifest = {
      languages: [{ name: "node", version: "22", tools: ["pnpm"] }],
      systemPackages: ["build-essential", "python3-dev"],
    };
    const plan = computeInstallPlan(needed, provides);
    expect(plan.languageInstalls).toEqual([]);
    expect(plan.systemPackages).toEqual([]);
  });

  it("includes missing languages", () => {
    const needed: RuntimeManifest = {
      languages: [{ name: "rust" }],
    };
    const provides: RuntimeManifest = {
      languages: [{ name: "node", version: "22" }],
    };
    const plan = computeInstallPlan(needed, provides);
    expect(plan.languageInstalls).toEqual([{ name: "rust" }]);
  });

  it("includes missing tools for existing language", () => {
    const needed: RuntimeManifest = {
      languages: [{ name: "python", tools: ["uv", "poetry"] }],
    };
    const provides: RuntimeManifest = {
      languages: [{ name: "python", version: "3", tools: ["pip"] }],
    };
    const plan = computeInstallPlan(needed, provides);
    expect(plan.languageInstalls).toEqual([{ name: "python", tools: ["uv", "poetry"] }]);
  });

  it("includes extra system packages", () => {
    const needed: RuntimeManifest = {
      systemPackages: ["ffmpeg", "build-essential"],
    };
    const provides: RuntimeManifest = {
      systemPackages: ["build-essential"],
    };
    const plan = computeInstallPlan(needed, provides);
    expect(plan.systemPackages).toEqual(["ffmpeg"]);
  });

  it("passes through node/python packages (not tracked in image provides)", () => {
    const needed: RuntimeManifest = {
      nodePackages: ["playwright"],
      pythonPackages: ["psycopg[binary]"],
    };
    const provides: RuntimeManifest = {};
    const plan = computeInstallPlan(needed, provides);
    expect(plan.nodePackages).toEqual(["playwright"]);
    expect(plan.pythonPackages).toEqual(["psycopg[binary]"]);
  });
});

// ── splitByTier ─────────────────────────────────────────────────────────────

describe("splitByTier", () => {
  it("splits repo to pod, everything else to task", () => {
    const tagged: TaggedManifest[] = [
      { source: "repo", sourceName: "r", manifest: {} },
      { source: "agent", sourceName: "a", manifest: {} },
      { source: "mcp", sourceName: "m", manifest: {} },
      { source: "skill", sourceName: "s", manifest: {} },
    ];
    const { pod, task } = splitByTier(tagged);
    expect(pod).toHaveLength(1);
    expect(pod[0].source).toBe("repo");
    expect(task).toHaveLength(3);
    expect(task.map((t) => t.source)).toEqual(["agent", "mcp", "skill"]);
  });
});

// ── computeRuntimeHash ──────────────────────────────────────────────────────

describe("computeRuntimeHash", () => {
  it("produces stable hash for same manifest", () => {
    const m: RuntimeManifest = {
      languages: [{ name: "node", version: "20" }],
      systemPackages: ["ffmpeg"],
    };
    const h1 = computeRuntimeHash(m);
    const h2 = computeRuntimeHash(m);
    expect(h1).toBe(h2);
  });

  it("produces different hash for different manifests", () => {
    const m1: RuntimeManifest = { languages: [{ name: "node" }] };
    const m2: RuntimeManifest = { languages: [{ name: "python" }] };
    expect(computeRuntimeHash(m1)).not.toBe(computeRuntimeHash(m2));
  });

  it("returns a 16-char hex string", () => {
    const hash = computeRuntimeHash({ systemPackages: ["jq"] });
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ── resolveRuntime (integration) ────────────────────────────────────────────

describe("resolveRuntime", () => {
  it("resolves a simple node repo", () => {
    const tagged: TaggedManifest[] = [
      {
        source: "repo",
        sourceName: "my-app",
        manifest: { languages: [{ name: "node", version: "20" }] },
      },
    ];
    const result = resolveRuntime(tagged);
    expect(result.image).toContain("optio-node");
    expect(result.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(result.conflicts).toEqual([]);
  });

  it("resolves repo + agent + skill with additive deps", () => {
    const tagged: TaggedManifest[] = [
      {
        source: "repo",
        sourceName: "fullstack-app",
        manifest: {
          languages: [{ name: "node" }, { name: "python" }],
          systemPackages: ["libpq-dev"],
        },
      },
      {
        source: "agent",
        sourceName: "coding-agent",
        manifest: {},
      },
      {
        source: "skill",
        sourceName: "playwright-skill",
        manifest: {
          systemPackages: ["libnss3"],
          nodePackages: ["playwright"],
        },
      },
    ];
    const result = resolveRuntime(tagged);
    expect(result.image).toContain("optio-full");
    // Pod plan has repo's libpq-dev
    expect(result.podInstallPlan.systemPackages).toContain("libpq-dev");
    // Task plan has skill's libnss3 + playwright
    expect(result.taskInstallPlan.systemPackages).toContain("libnss3");
    expect(result.taskInstallPlan.nodePackages).toContain("playwright");
  });

  it("produces empty task plan when no agent/skill/mcp deps", () => {
    const tagged: TaggedManifest[] = [
      {
        source: "repo",
        sourceName: "go-svc",
        manifest: { languages: [{ name: "go", version: "1.23" }] },
      },
    ];
    const result = resolveRuntime(tagged);
    expect(isEmptyInstallPlan(result.taskInstallPlan)).toBe(true);
  });
});

// ── synthesizeFromLegacy ────────────────────────────────────────────────────

describe("synthesizeFromLegacy", () => {
  it("converts node preset", () => {
    const m = synthesizeFromLegacy("node", null, null);
    expect(m.languages).toEqual([{ name: "node" }]);
  });

  it("converts python preset", () => {
    const m = synthesizeFromLegacy("python", null, null);
    expect(m.languages).toEqual([{ name: "python" }]);
  });

  it("converts full preset to multi-language", () => {
    const m = synthesizeFromLegacy("full", null, null);
    expect(m.languages!.map((l) => l.name).sort()).toEqual(["go", "node", "python", "rust"]);
  });

  it("parses extraPackages", () => {
    const m = synthesizeFromLegacy("base", "ffmpeg, jq, curl", null);
    expect(m.systemPackages).toEqual(["ffmpeg", "jq", "curl"]);
  });

  it("parses setupCommands", () => {
    const m = synthesizeFromLegacy("base", null, "npm install && npm run build");
    expect(m.setup).toEqual(["npm install", "npm run build"]);
  });

  it("returns empty manifest for base with no extras", () => {
    const m = synthesizeFromLegacy("base", null, null);
    expect(m).toEqual({});
  });

  it("handles null/undefined inputs", () => {
    const m = synthesizeFromLegacy(null, null, null);
    expect(m).toEqual({});
  });
});

// ── isEmptyInstallPlan ──────────────────────────────────────────────────────

describe("isEmptyInstallPlan", () => {
  it("returns true for empty plan", () => {
    const plan: InstallPlan = {
      systemPackages: [],
      nodePackages: [],
      pythonPackages: [],
      envVars: {},
      setupCommands: [],
      languageInstalls: [],
    };
    expect(isEmptyInstallPlan(plan)).toBe(true);
  });

  it("returns false when system packages present", () => {
    const plan: InstallPlan = {
      systemPackages: ["ffmpeg"],
      nodePackages: [],
      pythonPackages: [],
      envVars: {},
      setupCommands: [],
      languageInstalls: [],
    };
    expect(isEmptyInstallPlan(plan)).toBe(false);
  });
});
