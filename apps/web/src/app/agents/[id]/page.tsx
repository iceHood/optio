"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePageTitle } from "@/hooks/use-page-title";
import { api } from "@/lib/api-client";
import { Loader2, Save, Trash2, ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  usePageTitle("Edit Agent");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [agentType, setAgentType] = useState("claude-code");
  const [model, setModel] = useState("");
  const [contextWindow, setContextWindow] = useState("");
  const [thinking, setThinking] = useState<boolean | null>(null);
  const [effort, setEffort] = useState("");
  const [imagePreset, setImagePreset] = useState("");
  const [extraPackages, setExtraPackages] = useState("");
  const [setupCommands, setSetupCommands] = useState("");
  const [maxTurns, setMaxTurns] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");

  // MCP & Skills
  const [mcpServerIds, setMcpServerIds] = useState<string[]>([]);
  const [skillSetIds, setSkillSetIds] = useState<string[]>([]);
  const [allMcpServers, setAllMcpServers] = useState<any[]>([]);
  const [allSkillSets, setAllSkillSets] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.getAgent(id),
      api.getAgentMcpServers(id),
      api.getAgentSkillSets(id),
      api.listMcpServers(),
      api.listSkillSets(),
    ])
      .then(([agentRes, mcpRes, skillRes, allMcpRes, allSkillRes]) => {
        const a = agentRes.agent;
        setName(a.name);
        setDescription(a.description ?? "");
        setAgentType(a.agentType);
        setModel(a.model ?? "");
        setContextWindow(a.contextWindow ?? "");
        setThinking(a.thinking);
        setEffort(a.effort ?? "");
        setImagePreset(a.imagePreset ?? "");
        setExtraPackages(a.extraPackages ?? "");
        setSetupCommands(a.setupCommands ?? "");
        setMaxTurns(a.maxTurns != null ? String(a.maxTurns) : "");
        setPromptTemplate(a.promptTemplate ?? "");
        setMcpServerIds(mcpRes.mcpServerIds);
        setSkillSetIds(skillRes.skillSetIds);
        setAllMcpServers(allMcpRes.servers);
        setAllSkillSets(allSkillRes.skillSets);
      })
      .catch(() => toast.error("Failed to load agent"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        api.updateAgent(id, {
          name,
          description: description || null,
          agentType,
          model: model || null,
          contextWindow: contextWindow || null,
          thinking,
          effort: effort || null,
          imagePreset: imagePreset || null,
          extraPackages: extraPackages || null,
          setupCommands: setupCommands || null,
          maxTurns: maxTurns ? parseInt(maxTurns) : null,
          promptTemplate: promptTemplate || null,
        }),
        api.setAgentMcpServers(id, mcpServerIds),
        api.setAgentSkillSets(id, skillSetIds),
      ]);
      toast.success("Agent saved");
    } catch (err: any) {
      toast.error("Failed to save", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete agent "${name}"? This will remove it from any pipeline stages.`)) return;
    try {
      await api.deleteAgent(id);
      toast.success("Agent deleted");
      router.push("/agents");
    } catch (err: any) {
      toast.error("Failed to delete", { description: err.message });
    }
  };

  const toggleMcpServer = (serverId: string) => {
    setMcpServerIds((ids) =>
      ids.includes(serverId) ? ids.filter((i) => i !== serverId) : [...ids, serverId],
    );
  };

  const toggleSkillSet = (setId: string) => {
    setSkillSetIds((ids) =>
      ids.includes(setId) ? ids.filter((i) => i !== setId) : [...ids, setId],
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
      </div>
    );
  }

  const inputCls =
    "w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors";

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/agents" className="text-text-muted hover:text-text transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight flex-1">{name || "Edit Agent"}</h1>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-error hover:bg-error/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-white text-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="space-y-6">
        {/* Basic Info */}
        <section className="p-5 rounded-xl border border-border/50 bg-bg-card space-y-4">
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider">Basic</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Agent Type</label>
              <select
                value={agentType}
                onChange={(e) => setAgentType(e.target.value)}
                className={inputCls}
              >
                <option value="claude-code">Claude Code</option>
                <option value="codex">Codex</option>
                <option value="copilot">Copilot</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this agent specializes in"
              className={inputCls}
            />
          </div>
        </section>

        {/* Model & Execution */}
        <section className="p-5 rounded-xl border border-border/50 bg-bg-card space-y-4">
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider">
            Model & Execution
          </h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Model</label>
              <select value={model} onChange={(e) => setModel(e.target.value)} className={inputCls}>
                <option value="">Inherit from repo</option>
                <option value="opus">Opus</option>
                <option value="sonnet">Sonnet</option>
                <option value="haiku">Haiku</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Effort</label>
              <select
                value={effort}
                onChange={(e) => setEffort(e.target.value)}
                className={inputCls}
              >
                <option value="">Inherit from repo</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Max Turns</label>
              <input
                type="number"
                value={maxTurns}
                onChange={(e) => setMaxTurns(e.target.value)}
                placeholder="Inherit"
                min={1}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Context Window</label>
              <select
                value={contextWindow}
                onChange={(e) => setContextWindow(e.target.value)}
                className={inputCls}
              >
                <option value="">Inherit from repo</option>
                <option value="200k">200K</option>
                <option value="1m">1M</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Extended Thinking</label>
              <select
                value={thinking === null ? "" : String(thinking)}
                onChange={(e) => {
                  const v = e.target.value;
                  setThinking(v === "" ? null : v === "true");
                }}
                className={inputCls}
              >
                <option value="">Inherit from repo</option>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          </div>
        </section>

        {/* Container */}
        <section className="p-5 rounded-xl border border-border/50 bg-bg-card space-y-4">
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider">
            Container
          </h2>

          <div>
            <label className="block text-xs text-text-muted mb-1">Image Preset</label>
            <select
              value={imagePreset}
              onChange={(e) => setImagePreset(e.target.value)}
              className={inputCls}
            >
              <option value="">Inherit from repo</option>
              <option value="base">Base</option>
              <option value="node">Node</option>
              <option value="python">Python</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
              <option value="full">Full</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">
              Extra Packages (comma-separated)
            </label>
            <input
              type="text"
              value={extraPackages}
              onChange={(e) => setExtraPackages(e.target.value)}
              placeholder="e.g. postgresql-client, jq"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Setup Commands</label>
            <textarea
              value={setupCommands}
              onChange={(e) => setSetupCommands(e.target.value)}
              placeholder="Shell commands run at pod startup"
              rows={2}
              className={inputCls + " resize-y"}
            />
          </div>
        </section>

        {/* MCP Servers */}
        {allMcpServers.length > 0 && (
          <section className="p-5 rounded-xl border border-border/50 bg-bg-card space-y-3">
            <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider">
              MCP Servers
            </h2>
            <div className="space-y-1">
              {allMcpServers.map((s: any) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-hover/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={mcpServerIds.includes(s.id)}
                    onChange={() => toggleMcpServer(s.id)}
                    className="rounded border-border"
                  />
                  <span className="text-sm">{s.name}</span>
                  <span className="text-xs text-text-muted">{s.command}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        {/* Skill Sets */}
        {allSkillSets.length > 0 && (
          <section className="p-5 rounded-xl border border-border/50 bg-bg-card space-y-3">
            <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider">
              Skill Sets
            </h2>
            <div className="space-y-1">
              {allSkillSets.map((s: any) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-hover/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={skillSetIds.includes(s.id)}
                    onChange={() => toggleSkillSet(s.id)}
                    className="rounded border-border"
                  />
                  <span className="text-sm">{s.name}</span>
                  {s.description && (
                    <span className="text-xs text-text-muted">{s.description}</span>
                  )}
                </label>
              ))}
            </div>
          </section>
        )}

        {/* Advanced: Prompt Template */}
        <section className="p-5 rounded-xl border border-border/50 bg-bg-card space-y-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-medium text-text-muted uppercase tracking-wider hover:text-text transition-colors w-full"
          >
            {showAdvanced ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Advanced
          </button>

          {showAdvanced && (
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Custom Prompt Template (overrides repo template)
              </label>
              <textarea
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
                placeholder="Leave empty to inherit from repo"
                rows={6}
                className={inputCls + " resize-y font-mono text-xs"}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
