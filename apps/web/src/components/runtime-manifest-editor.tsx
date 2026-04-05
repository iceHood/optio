"use client";

import { useState } from "react";
import { Box, Plus, X, ChevronDown, ChevronRight, Terminal, Package, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────────────

interface LanguageRequirement {
  name: "node" | "python" | "go" | "rust";
  version?: string;
  tools?: string[];
}

type RuntimeCapability = "docker" | "gpu" | "browser";

interface RuntimeManifest {
  languages?: LanguageRequirement[];
  systemPackages?: string[];
  nodePackages?: string[];
  pythonPackages?: string[];
  env?: Record<string, string>;
  setup?: string[];
  capabilities?: RuntimeCapability[];
}

// ── Language definitions ────────────────────────────────────────────────────

const LANGUAGES: Array<{
  name: LanguageRequirement["name"];
  label: string;
  icon: string;
  defaultVersion: string;
  commonTools: string[];
}> = [
  {
    name: "node",
    label: "Node.js",
    icon: "JS",
    defaultVersion: "22",
    commonTools: ["pnpm", "yarn", "bun"],
  },
  {
    name: "python",
    label: "Python",
    icon: "PY",
    defaultVersion: "3",
    commonTools: ["pip", "uv", "poetry"],
  },
  { name: "go", label: "Go", icon: "GO", defaultVersion: "1.23", commonTools: ["protoc", "gopls"] },
  {
    name: "rust",
    label: "Rust",
    icon: "RS",
    defaultVersion: "",
    commonTools: ["cargo-watch", "cargo-nextest"],
  },
];

const CAPABILITIES: Array<{ name: RuntimeCapability; label: string; description: string }> = [
  { name: "docker", label: "Docker", description: "Docker daemon for builds" },
  { name: "browser", label: "Browser", description: "Headless browser for testing" },
  { name: "gpu", label: "GPU", description: "GPU access for ML workloads" },
];

// ── Props ───────────────────────────────────────────────────────────────────

interface RuntimeManifestEditorProps {
  value: RuntimeManifest;
  onChange: (manifest: RuntimeManifest) => void;
  /** Compact mode for agent deps (fewer options) */
  compact?: boolean;
  /** Label override */
  label?: string;
  /** Description override */
  description?: string;
  /** Show auto-detected hint */
  detected?: boolean;
}

// ── Component ───────────────────────────────────────────────────────────────

export function RuntimeManifestEditor({
  value,
  onChange,
  compact = false,
  label = "Runtime Environment",
  description,
  detected = false,
}: RuntimeManifestEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");

  const activeLangs = new Set((value.languages ?? []).map((l) => l.name));
  const activeCaps = new Set(value.capabilities ?? []);

  // ── Language toggle ─────────────────────────────────────────────────────

  function toggleLanguage(name: LanguageRequirement["name"]) {
    const current = value.languages ?? [];
    if (activeLangs.has(name)) {
      onChange({ ...value, languages: current.filter((l) => l.name !== name) });
    } else {
      const def = LANGUAGES.find((l) => l.name === name)!;
      onChange({
        ...value,
        languages: [...current, { name, version: def.defaultVersion || undefined }],
      });
    }
  }

  function updateLangVersion(name: string, version: string) {
    const langs = (value.languages ?? []).map((l) =>
      l.name === name ? { ...l, version: version || undefined } : l,
    );
    onChange({ ...value, languages: langs });
  }

  function toggleTool(langName: string, tool: string) {
    const langs = (value.languages ?? []).map((l) => {
      if (l.name !== langName) return l;
      const tools = new Set(l.tools ?? []);
      if (tools.has(tool)) tools.delete(tool);
      else tools.add(tool);
      return { ...l, tools: tools.size > 0 ? [...tools] : undefined };
    });
    onChange({ ...value, languages: langs });
  }

  // ── Capability toggle ───────────────────────────────────────────────────

  function toggleCapability(cap: RuntimeCapability) {
    const current = new Set(value.capabilities ?? []);
    if (current.has(cap)) current.delete(cap);
    else current.add(cap);
    onChange({ ...value, capabilities: current.size > 0 ? [...current] : undefined });
  }

  // ── Package helpers ─────────────────────────────────────────────────────

  function setPackageList(
    field: "systemPackages" | "nodePackages" | "pythonPackages",
    raw: string,
  ) {
    const pkgs = raw
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({ ...value, [field]: pkgs.length > 0 ? pkgs : undefined });
  }

  function getPackageString(field: "systemPackages" | "nodePackages" | "pythonPackages") {
    return (value[field] ?? []).join(", ");
  }

  // ── Env var helpers ─────────────────────────────────────────────────────

  function addEnvVar() {
    if (!newEnvKey.trim()) return;
    const env = { ...(value.env ?? {}), [newEnvKey.trim()]: newEnvVal };
    onChange({ ...value, env });
    setNewEnvKey("");
    setNewEnvVal("");
  }

  function removeEnvVar(key: string) {
    const env = { ...(value.env ?? {}) };
    delete env[key];
    onChange({ ...value, env: Object.keys(env).length > 0 ? env : undefined });
  }

  // ── Setup commands ──────────────────────────────────────────────────────

  function setSetup(raw: string) {
    const cmds = raw.split("\n").filter((s) => s.trim());
    onChange({ ...value, setup: cmds.length > 0 ? cmds : undefined });
  }

  const inputCls =
    "w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-sm font-medium">{label}</h2>
        <p className="text-xs text-text-muted mt-0.5">
          {description ??
            (compact
              ? "Declare runtime dependencies this agent needs. These are additive on top of the repo environment."
              : "Define the execution environment for this repository. Languages, packages, and capabilities are composed into the pod runtime.")}
          {detected && " Auto-detected from repository contents."}
        </p>
      </div>

      {/* Language toggles */}
      <div>
        <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider font-medium">
          Languages
        </label>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((lang) => {
            const active = activeLangs.has(lang.name);
            const langReq = (value.languages ?? []).find((l) => l.name === lang.name);
            return (
              <div key={lang.name} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => toggleLanguage(lang.name)}
                  className={cn(
                    "w-full flex items-center gap-2.5 p-2.5 rounded-lg border text-left text-sm transition-all",
                    active
                      ? "border-primary bg-primary/5 shadow-[0_0_0_1px] shadow-primary/20"
                      : "border-border hover:border-text-muted/50 bg-bg",
                  )}
                >
                  <span
                    className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold tracking-tight shrink-0",
                      active ? "bg-primary text-bg" : "bg-border/50 text-text-muted",
                    )}
                  >
                    {lang.icon}
                  </span>
                  <div className="min-w-0">
                    <span className="font-medium block">{lang.label}</span>
                  </div>
                </button>

                {/* Version + tools (shown when active) */}
                {active && (
                  <div className="pl-1 space-y-1.5">
                    <input
                      value={langReq?.version ?? ""}
                      onChange={(e) => updateLangVersion(lang.name, e.target.value)}
                      placeholder="version"
                      className="w-full px-2.5 py-1.5 rounded-md bg-bg border border-border text-xs focus:outline-none focus:border-primary"
                    />
                    <div className="flex flex-wrap gap-1">
                      {lang.commonTools.map((tool) => {
                        const isOn = (langReq?.tools ?? []).includes(tool);
                        return (
                          <button
                            key={tool}
                            type="button"
                            onClick={() => toggleTool(lang.name, tool)}
                            className={cn(
                              "px-2 py-0.5 rounded text-[11px] border transition-colors",
                              isOn
                                ? "border-primary/50 bg-primary/10 text-primary"
                                : "border-border text-text-muted hover:border-text-muted/50",
                            )}
                          >
                            {tool}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Capabilities (repo mode only) */}
      {!compact && (
        <div>
          <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider font-medium">
            Capabilities
          </label>
          <div className="flex flex-wrap gap-2">
            {CAPABILITIES.map((cap) => {
              const active = activeCaps.has(cap.name);
              return (
                <button
                  key={cap.name}
                  type="button"
                  onClick={() => toggleCapability(cap.name)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-text-muted/50 bg-bg",
                  )}
                >
                  <Box className={cn("w-3.5 h-3.5", active ? "text-primary" : "text-text-muted")} />
                  <span>{cap.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* System packages */}
      <div>
        <label className="block text-xs text-text-muted mb-1">
          <Package className="w-3 h-3 inline mr-1 -mt-0.5" />
          System Packages
          <span className="text-text-muted/50 ml-1">(apt)</span>
        </label>
        <input
          value={getPackageString("systemPackages")}
          onChange={(e) => setPackageList("systemPackages", e.target.value)}
          placeholder="ffmpeg, jq, postgresql-client"
          className={inputCls}
        />
      </div>

      {/* Node/Python packages (shown if relevant language is active) */}
      {activeLangs.has("node") && (
        <div>
          <label className="block text-xs text-text-muted mb-1">
            <Globe className="w-3 h-3 inline mr-1 -mt-0.5" />
            Node Packages
            <span className="text-text-muted/50 ml-1">(global npm)</span>
          </label>
          <input
            value={getPackageString("nodePackages")}
            onChange={(e) => setPackageList("nodePackages", e.target.value)}
            placeholder="playwright, tsx"
            className={inputCls}
          />
        </div>
      )}

      {activeLangs.has("python") && (
        <div>
          <label className="block text-xs text-text-muted mb-1">
            <Globe className="w-3 h-3 inline mr-1 -mt-0.5" />
            Python Packages
            <span className="text-text-muted/50 ml-1">(pip)</span>
          </label>
          <input
            value={getPackageString("pythonPackages")}
            onChange={(e) => setPackageList("pythonPackages", e.target.value)}
            placeholder="psycopg[binary], boto3"
            className={inputCls}
          />
        </div>
      )}

      {/* Advanced: setup commands + env vars */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        {showAdvanced ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {showAdvanced ? "Hide advanced" : "Advanced options"}
      </button>

      {showAdvanced && (
        <div className="space-y-4 pt-2 border-t border-border">
          {/* Setup commands */}
          <div>
            <label className="block text-xs text-text-muted mb-1">
              <Terminal className="w-3 h-3 inline mr-1 -mt-0.5" />
              Setup Commands
            </label>
            <p className="text-[10px] text-text-muted/60 mb-1.5">
              Shell commands run at pod startup. One per line.
            </p>
            <textarea
              value={(value.setup ?? []).join("\n")}
              onChange={(e) => setSetup(e.target.value)}
              rows={3}
              placeholder={"npm install\nnpx playwright install --with-deps"}
              className={cn(inputCls, "resize-y leading-relaxed font-mono text-xs")}
            />
          </div>

          {/* Env vars */}
          <div>
            <label className="block text-xs text-text-muted mb-1">Environment Variables</label>
            {Object.entries(value.env ?? {}).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5 mb-1.5">
                <span className="px-2 py-1 rounded bg-border/30 text-xs font-mono">{key}</span>
                <span className="text-text-muted text-xs">=</span>
                <span className="px-2 py-1 rounded bg-border/30 text-xs font-mono truncate flex-1">
                  {val}
                </span>
                <button
                  type="button"
                  onClick={() => removeEnvVar(key)}
                  className="text-text-muted hover:text-red-400 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <input
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                placeholder="KEY"
                className="px-2 py-1.5 rounded-md bg-bg border border-border text-xs font-mono w-28 focus:outline-none focus:border-primary"
                onKeyDown={(e) => e.key === "Enter" && addEnvVar()}
              />
              <span className="text-text-muted text-xs">=</span>
              <input
                value={newEnvVal}
                onChange={(e) => setNewEnvVal(e.target.value)}
                placeholder="value"
                className="px-2 py-1.5 rounded-md bg-bg border border-border text-xs font-mono flex-1 focus:outline-none focus:border-primary"
                onKeyDown={(e) => e.key === "Enter" && addEnvVar()}
              />
              <button
                type="button"
                onClick={addEnvVar}
                className="p-1.5 rounded-md border border-border hover:border-primary text-text-muted hover:text-primary transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper: Convert between manifest and legacy fields ──────────────────────

/** Synthesize a RuntimeManifest from legacy imagePreset + extraPackages */
export function manifestFromLegacy(
  imagePreset?: string | null,
  extraPackages?: string | null,
): RuntimeManifest {
  const manifest: RuntimeManifest = {};
  const presetLangs: Record<string, LanguageRequirement["name"][]> = {
    node: ["node"],
    python: ["python"],
    go: ["go"],
    rust: ["rust"],
    full: ["node", "python", "go", "rust"],
  };
  const langs = imagePreset ? presetLangs[imagePreset] : undefined;
  if (langs?.length) manifest.languages = langs.map((name) => ({ name }));
  if (extraPackages) {
    const pkgs = extraPackages.split(/[,\s]+/).filter(Boolean);
    if (pkgs.length) manifest.systemPackages = pkgs;
  }
  return manifest;
}

/** Check if a manifest is empty (no meaningful content) */
export function isManifestEmpty(m: RuntimeManifest | null | undefined): boolean {
  if (!m) return true;
  return (
    (!m.languages || m.languages.length === 0) &&
    (!m.systemPackages || m.systemPackages.length === 0) &&
    (!m.nodePackages || m.nodePackages.length === 0) &&
    (!m.pythonPackages || m.pythonPackages.length === 0) &&
    (!m.env || Object.keys(m.env).length === 0) &&
    (!m.setup || m.setup.length === 0) &&
    (!m.capabilities || m.capabilities.length === 0)
  );
}
