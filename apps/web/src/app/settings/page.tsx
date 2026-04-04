"use client";

import { useState, useEffect } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { api } from "@/lib/api-client";
import { NumberInput } from "@/components/number-input";
import { toast } from "sonner";
import {
  Loader2,
  Bell,
  RefreshCw,
  Shield,
  CheckCircle2,
  XCircle,
  Server,
  Sparkles,
  Plus,
  X,
  Bot,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Github,
  KeyRound,
  Download,
  Package,
  Trash2,
  Layers,
} from "lucide-react";
import { OPTIO_TOOL_CATEGORIES, ALL_OPTIO_TOOL_NAMES } from "@optio/shared";

function PromptTemplateEditor() {
  const [template, setTemplate] = useState("");
  const [autoMerge, setAutoMerge] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getEffectiveTemplate()
      .then((res) => {
        setTemplate(res.template);
        setAutoMerge(res.autoMerge);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.savePromptTemplate({ template, autoMerge });
      toast.success("Prompt template saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const res = await api.getBuiltinDefault();
    setTemplate(res.template);
  };

  if (loading) {
    return (
      <div className="p-5 rounded-xl border border-border/50 bg-bg-card text-center text-text-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading...
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl border border-border/50 bg-bg-card space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          Default prompt used for all repos unless overridden in repo settings.
        </p>
        <button onClick={handleReset} className="text-xs text-primary hover:underline">
          Reset to default
        </button>
      </div>
      <div className="p-3 rounded-md bg-bg border border-border">
        <p className="text-xs text-text-muted mb-2">Available template variables:</p>
        <ul className="text-xs space-y-1.5">
          <li className="flex items-start gap-2">
            <code className="text-primary shrink-0">{"{{TASK_FILE}}"}</code>
            <span className="text-text-muted">
              Path to the task markdown file written into the worktree
            </span>
          </li>
          <li className="flex items-start gap-2">
            <code className="text-primary shrink-0">{"{{BRANCH_NAME}}"}</code>
            <span className="text-text-muted">Git branch name the agent is working on</span>
          </li>
          <li className="flex items-start gap-2">
            <code className="text-primary shrink-0">{"{{TASK_ID}}"}</code>
            <span className="text-text-muted">Unique task identifier</span>
          </li>
          <li className="flex items-start gap-2">
            <code className="text-primary shrink-0">{"{{TASK_TITLE}}"}</code>
            <span className="text-text-muted">Short title of the task</span>
          </li>
          <li className="flex items-start gap-2">
            <code className="text-primary shrink-0">{"{{REPO_NAME}}"}</code>
            <span className="text-text-muted">Repository name (e.g. owner/repo)</span>
          </li>
          <li className="flex items-start gap-2">
            <code className="text-primary shrink-0">{"{{AUTO_MERGE}}"}</code>
            <span className="text-text-muted">
              Whether auto-merge is enabled — use with{" "}
              <code className="text-primary">{"{{#if AUTO_MERGE}}...{{/if}}"}</code>
            </span>
          </li>
        </ul>
      </div>
      <textarea
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        rows={12}
        className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-xs font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-y leading-relaxed"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={autoMerge}
            onChange={(e) => setAutoMerge(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Auto-merge PRs
        </label>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 rounded-md bg-primary text-white text-xs hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function DefaultReviewEditor() {
  const [reviewPrompt, setReviewPrompt] = useState("");
  const [reviewModel, setReviewModel] = useState("sonnet");
  const [reviewTrigger, setReviewTrigger] = useState("on_ci_pass");
  const [reviewContextWindow, setReviewContextWindow] = useState("200k");
  const [reviewEffort, setReviewEffort] = useState("medium");
  const [reviewThinking, setReviewThinking] = useState(true);
  const [reviewTestCommand, setReviewTestCommand] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getReviewDefault()
      .then((res) => setReviewPrompt(res.template))
      .catch(() => {
        import("@optio/shared")
          .then((m) => setReviewPrompt(m.DEFAULT_REVIEW_PROMPT_TEMPLATE))
          .catch(() => {});
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-5 rounded-xl border border-border/50 bg-bg-card text-center text-text-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading...
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl border border-border/50 bg-bg-card space-y-3">
      <p className="text-xs text-text-muted">
        Default review settings applied to all repos unless overridden in repo settings.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-text-muted mb-1">Default Trigger</label>
          <select
            value={reviewTrigger}
            onChange={(e) => setReviewTrigger(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
          >
            <option value="on_ci_pass">After CI passes</option>
            <option value="on_pr">Immediately on PR open</option>
            <option value="manual">Manual only</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Default Review Model</label>
          <select
            value={reviewModel}
            onChange={(e) => setReviewModel(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
          >
            <option value="sonnet">Sonnet 4.6</option>
            <option value="opus">Opus 4.6</option>
            <option value="haiku">Haiku 4.5</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-text-muted mb-1">Context Window</label>
          <select
            value={reviewContextWindow}
            onChange={(e) => setReviewContextWindow(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
          >
            <option value="200k">200K tokens</option>
            <option value="1m">1M tokens</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Effort Level</label>
          <select
            value={reviewEffort}
            onChange={(e) => setReviewEffort(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={reviewThinking}
              onChange={(e) => setReviewThinking(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">Thinking</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-xs text-text-muted mb-1">Default Test Command</label>
        <p className="text-[10px] text-text-muted/60 mb-1.5">
          Command to run tests locally. Leave empty if GitHub Actions handles testing — the reviewer
          will check CI status instead.
        </p>
        <input
          value={reviewTestCommand}
          onChange={(e) => setReviewTestCommand(e.target.value)}
          placeholder="npm test, cargo test, pytest"
          className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
        />
      </div>

      <div className="p-3 rounded-md bg-bg border border-border">
        <p className="text-xs text-text-muted mb-2">Available template variables:</p>
        <ul className="text-xs space-y-1.5">
          <li className="flex items-start gap-2">
            <code className="text-primary shrink-0">{"{{PR_NUMBER}}"}</code>
            <span className="text-text-muted">Pull request number</span>
          </li>
          <li className="flex items-start gap-2">
            <code className="text-primary shrink-0">{"{{TASK_FILE}}"}</code>
            <span className="text-text-muted">Path to the review context file</span>
          </li>
          <li className="flex items-start gap-2">
            <code className="text-primary shrink-0">{"{{REPO_NAME}}"}</code>
            <span className="text-text-muted">Repository name (e.g. owner/repo)</span>
          </li>
          <li className="flex items-start gap-2">
            <code className="text-primary shrink-0">{"{{TASK_TITLE}}"}</code>
            <span className="text-text-muted">Original task title</span>
          </li>
          <li className="flex items-start gap-2">
            <code className="text-primary shrink-0">{"{{TEST_COMMAND}}"}</code>
            <span className="text-text-muted">Test command from repo settings</span>
          </li>
        </ul>
      </div>

      <textarea
        value={reviewPrompt}
        onChange={(e) => setReviewPrompt(e.target.value)}
        rows={10}
        className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-xs font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-y leading-relaxed"
      />

      <div className="flex items-center justify-between">
        <button
          onClick={() =>
            import("@optio/shared").then((m) => setReviewPrompt(m.DEFAULT_REVIEW_PROMPT_TEMPLATE))
          }
          className="text-xs text-primary hover:underline"
        >
          Reset to default
        </button>
        <button
          onClick={async () => {
            setSaving(true);
            try {
              await api.saveReviewDefault(reviewPrompt);
              toast.success("Review defaults saved");
            } catch {
              toast.error("Failed to save");
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          className="px-4 py-1.5 rounded-md bg-primary text-white text-xs hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function GlobalMcpServers() {
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [env, setEnv] = useState("");
  const [installCmd, setInstallCmd] = useState("");

  useEffect(() => {
    api
      .listMcpServers("global")
      .then((res) => setServers(res.servers))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-5 rounded-xl border border-border/50 bg-bg-card text-center text-text-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading...
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl border border-border/50 bg-bg-card space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          Global MCP servers are available to all repos. Use{" "}
          <code className="text-primary">{"${{SECRET_NAME}}"}</code> to reference Optio secrets.
        </p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {servers.length > 0 && (
        <div className="space-y-2">
          {servers.map((server: any) => (
            <div
              key={server.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-bg"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{server.name}</span>
                  {!server.enabled && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning">
                      disabled
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5 font-mono truncate">
                  {server.command} {(server.args ?? []).join(" ")}
                </p>
              </div>
              <button
                onClick={async () => {
                  await api.updateMcpServer(server.id, { enabled: !server.enabled });
                  setServers((prev) =>
                    prev.map((s) => (s.id === server.id ? { ...s, enabled: !s.enabled } : s)),
                  );
                }}
                className="text-xs text-text-muted hover:text-text"
              >
                {server.enabled ? "Disable" : "Enable"}
              </button>
              <button
                onClick={async () => {
                  await api.deleteMcpServer(server.id);
                  setServers((prev) => prev.filter((s) => s.id !== server.id));
                  toast.success("MCP server removed");
                }}
                className="text-text-muted hover:text-error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {servers.length === 0 && !showAdd && (
        <p className="text-xs text-text-muted/60 text-center py-2">
          No global MCP servers configured.
        </p>
      )}

      {showAdd && (
        <div className="space-y-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="postgres"
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Command</label>
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="npx"
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Args (one per line)</label>
            <textarea
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              rows={2}
              placeholder={"-y\n@modelcontextprotocol/server-postgres"}
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-xs font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-y"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">
              Env vars (KEY=VALUE, one per line)
            </label>
            <textarea
              value={env}
              onChange={(e) => setEnv(e.target.value)}
              rows={2}
              placeholder={"POSTGRES_URL=${{POSTGRES_URL}}"}
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-xs font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-y"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Install command (optional)</label>
            <input
              value={installCmd}
              onChange={(e) => setInstallCmd(e.target.value)}
              placeholder="npm install -g @modelcontextprotocol/server-postgres"
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAdd(false);
                setName("");
                setCommand("");
                setArgs("");
                setEnv("");
                setInstallCmd("");
              }}
              className="px-3 py-1.5 rounded-md text-xs text-text-muted hover:bg-bg-hover"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!name || !command) {
                  toast.error("Name and command are required");
                  return;
                }
                const parsedArgs = args
                  .split("\n")
                  .map((a) => a.trim())
                  .filter(Boolean);
                const parsedEnv: Record<string, string> = {};
                for (const line of env.split("\n")) {
                  const idx = line.indexOf("=");
                  if (idx > 0) parsedEnv[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
                }
                const res = await api.createMcpServer({
                  name,
                  command,
                  args: parsedArgs.length > 0 ? parsedArgs : undefined,
                  env: Object.keys(parsedEnv).length > 0 ? parsedEnv : undefined,
                  installCommand: installCmd || undefined,
                });
                setServers((prev) => [...prev, res.server]);
                setShowAdd(false);
                setName("");
                setCommand("");
                setArgs("");
                setEnv("");
                setInstallCmd("");
                toast.success("MCP server added");
              }}
              className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary-hover"
            >
              Add Server
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GlobalSkills() {
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    api
      .listSkills("global")
      .then((res) => setSkills(res.skills))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-5 rounded-xl border border-border/50 bg-bg-card text-center text-text-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading...
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl border border-border/50 bg-bg-card space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          Global skills are available as slash commands to agents in all repos. Written to{" "}
          <code className="text-primary">.claude/commands/</code> before the agent starts.
        </p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {skills.length > 0 && (
        <div className="space-y-2">
          {skills.map((skill: any) => (
            <div
              key={skill.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-bg"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">/{skill.name}</span>
                  {!skill.enabled && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning">
                      disabled
                    </span>
                  )}
                </div>
                {skill.description && (
                  <p className="text-xs text-text-muted mt-0.5 truncate">{skill.description}</p>
                )}
              </div>
              <button
                onClick={async () => {
                  await api.updateSkill(skill.id, { enabled: !skill.enabled });
                  setSkills((prev) =>
                    prev.map((s) => (s.id === skill.id ? { ...s, enabled: !s.enabled } : s)),
                  );
                }}
                className="text-xs text-text-muted hover:text-text"
              >
                {skill.enabled ? "Disable" : "Enable"}
              </button>
              <button
                onClick={async () => {
                  await api.deleteSkill(skill.id);
                  setSkills((prev) => prev.filter((s) => s.id !== skill.id));
                  toast.success("Skill removed");
                }}
                className="text-text-muted hover:text-error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {skills.length === 0 && !showAdd && (
        <p className="text-xs text-text-muted/60 text-center py-2">No global skills configured.</p>
      )}

      {showAdd && (
        <div className="space-y-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="run-tests"
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Run the full test suite"
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Prompt (markdown)</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              placeholder="Run the full test suite and analyze any failures..."
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-xs font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-y"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAdd(false);
                setName("");
                setDescription("");
                setPrompt("");
              }}
              className="px-3 py-1.5 rounded-md text-xs text-text-muted hover:bg-bg-hover"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!name || !prompt) {
                  toast.error("Name and prompt are required");
                  return;
                }
                const res = await api.createSkill({
                  name,
                  description: description || undefined,
                  prompt,
                });
                setSkills((prev) => [...prev, res.skill]);
                setShowAdd(false);
                setName("");
                setDescription("");
                setPrompt("");
                toast.success("Skill added");
              }}
              className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary-hover"
            >
              Add Skill
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthenticationSettings() {
  const [providers, setProviders] = useState<Array<{ name: string; displayName: string }>>([]);
  const [authDisabled, setAuthDisabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAuthProviders()
      .then((res) => {
        setProviders(res.providers);
        setAuthDisabled(res.authDisabled);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-5 rounded-xl border border-border/50 bg-bg-card text-center text-text-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading...
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl border border-border/50 bg-bg-card space-y-4">
      {authDisabled && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
          <Shield className="w-4 h-4 shrink-0" />
          <div>
            <p className="font-medium">Authentication is disabled</p>
            <p className="text-amber-400/70 mt-0.5">
              Set{" "}
              <code className="px-1 py-0.5 bg-amber-500/10 rounded">OPTIO_AUTH_DISABLED=false</code>{" "}
              and configure OAuth providers to enable authentication.
            </p>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs text-text-muted mb-3">
          OAuth providers are auto-detected from environment variables. Configure the client ID and
          secret for each provider you want to enable.
        </p>

        <div className="space-y-2">
          {(["github", "google", "gitlab"] as const).map((name) => {
            const enabled = providers.some((p) => p.name === name);
            const displayName =
              name === "github" ? "GitHub" : name === "google" ? "Google" : "GitLab";
            const envPrefix = name.toUpperCase();
            return (
              <div
                key={name}
                className="flex items-center justify-between p-3 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  {enabled ? (
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-text-muted/40 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{displayName}</p>
                    <p className="text-[10px] text-text-muted">
                      {`${envPrefix}_OAUTH_CLIENT_ID`} / {`${envPrefix}_OAUTH_CLIENT_SECRET`}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    enabled ? "bg-success/10 text-success" : "bg-text-muted/10 text-text-muted"
                  }`}
                >
                  {enabled ? "Configured" : "Not configured"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OptioAgentSettings() {
  const [model, setModel] = useState("sonnet");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [enabledTools, setEnabledTools] = useState<string[]>([...ALL_OPTIO_TOOL_NAMES]);
  const [confirmWrites, setConfirmWrites] = useState(true);
  const [maxTurns, setMaxTurns] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBasePrompt, setShowBasePrompt] = useState(false);

  useEffect(() => {
    api
      .getOptioSettings()
      .then((res) => {
        const s = res.settings;
        setModel(s.model);
        setSystemPrompt(s.systemPrompt);
        // Empty array means "all enabled" (default state)
        setEnabledTools(
          s.enabledTools && s.enabledTools.length > 0 ? s.enabledTools : [...ALL_OPTIO_TOOL_NAMES],
        );
        setConfirmWrites(s.confirmWrites);
        setMaxTurns(s.maxTurns);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (enabledTools.length === 0) {
      toast.error("At least one tool must be enabled");
      return;
    }
    setSaving(true);
    try {
      // If all tools are enabled, store empty array (meaning "all")
      const toolsToSave = enabledTools.length === ALL_OPTIO_TOOL_NAMES.length ? [] : enabledTools;
      await api.updateOptioSettings({
        model,
        systemPrompt,
        enabledTools: toolsToSave.length === 0 ? ALL_OPTIO_TOOL_NAMES : toolsToSave,
        confirmWrites,
        maxTurns,
      });
      toast.success("Optio agent settings saved");
    } catch (err) {
      toast.error("Failed to save settings", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleTool = (toolName: string) => {
    setEnabledTools((prev) =>
      prev.includes(toolName) ? prev.filter((t) => t !== toolName) : [...prev, toolName],
    );
  };

  const enableAll = () => setEnabledTools([...ALL_OPTIO_TOOL_NAMES]);
  const disableAll = () => setEnabledTools([]);

  if (loading) {
    return (
      <div className="p-5 rounded-xl border border-border/50 bg-bg-card text-center text-text-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading...
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl border border-border/50 bg-bg-card space-y-5">
      {/* Model Selection */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
        >
          <option value="opus">Opus — most capable, highest cost</option>
          <option value="sonnet">Sonnet — balanced capability and cost</option>
          <option value="haiku">Haiku — fastest, lowest cost</option>
        </select>
      </div>

      {/* System Prompt */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">
          Custom System Prompt
        </label>
        <p className="text-xs text-text-muted mb-2">
          These instructions are appended to Optio&apos;s base prompt. Use this to add context about
          your team&apos;s workflows, naming conventions, or preferences.
        </p>
        <button
          onClick={() => setShowBasePrompt(!showBasePrompt)}
          className="flex items-center gap-1 text-xs text-primary hover:underline mb-2"
        >
          {showBasePrompt ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          {showBasePrompt ? "Hide" : "Show"} base system prompt
        </button>
        {showBasePrompt && (
          <div className="p-3 rounded-md bg-bg border border-border mb-2 max-h-48 overflow-y-auto">
            <p className="text-xs text-text-muted font-mono whitespace-pre-wrap">
              The base system prompt is defined in code and includes instructions for task
              execution, PR creation, and tool usage. Your custom prompt below is appended after the
              base prompt to provide additional context.
            </p>
          </div>
        )}
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={6}
          placeholder="e.g., Always use conventional commits. Follow our coding style guide at docs/STYLE.md..."
          className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-xs font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-y leading-relaxed"
        />
      </div>

      {/* Tool Enablement */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-text-muted">Enabled Tools</label>
          <div className="flex gap-2">
            <button onClick={enableAll} className="text-xs text-primary hover:underline">
              Enable all
            </button>
            <span className="text-xs text-text-muted">|</span>
            <button onClick={disableAll} className="text-xs text-primary hover:underline">
              Disable all
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {OPTIO_TOOL_CATEGORIES.map((category) => (
            <div key={category.name} className="p-3 rounded-md bg-bg border border-border">
              <h4 className="text-xs font-medium mb-2">{category.name}</h4>
              <div className="space-y-1.5">
                {category.tools.map((tool) => (
                  <label key={tool.name} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabledTools.includes(tool.name)}
                      onChange={() => toggleTool(tool.name)}
                      className="w-3.5 h-3.5 rounded"
                    />
                    <span className="font-medium">{tool.name}</span>
                    <span className="text-text-muted">— {tool.description}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {enabledTools.length === 0 && (
          <p className="text-xs text-error mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            At least one tool must be enabled
          </p>
        )}
      </div>

      {/* Confirmation Behavior */}
      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={confirmWrites}
            onChange={(e) => setConfirmWrites(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Require confirmation for write operations
        </label>
        {!confirmWrites && (
          <p className="text-xs text-warning mt-1 flex items-center gap-1 ml-6">
            <AlertTriangle className="w-3 h-3" />
            Optio will execute actions immediately without asking for approval
          </p>
        )}
      </div>

      {/* Max Conversation Length */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">
          Max Conversation Turns
        </label>
        <p className="text-xs text-text-muted mb-2">
          Maximum back-and-forth exchanges per session (5–50).
        </p>
        <NumberInput
          min={5}
          max={50}
          value={maxTurns}
          onChange={(v) => setMaxTurns(v)}
          fallback={25}
          className="w-32 px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
        />
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || enabledTools.length === 0}
          className="px-4 py-1.5 rounded-md bg-primary text-white text-xs hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

function GitHubTokenManager() {
  const [status, setStatus] = useState<"valid" | "expired" | "missing" | "error" | null>(null);
  const [source, setSource] = useState<"pat" | "github_app" | undefined>();
  const [user, setUser] = useState<{ login: string; name: string } | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [newToken, setNewToken] = useState("");
  const [rotating, setRotating] = useState(false);
  const [showRotateForm, setShowRotateForm] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await api.getGithubTokenStatus();
      setStatus(res.status);
      setSource(res.source);
      setUser(res.user);
      setMessage(res.message ?? res.error);
    } catch {
      setStatus("error");
      setMessage("Failed to check token status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleRotate = async () => {
    if (!newToken.trim()) return;
    setRotating(true);
    try {
      const res = await api.rotateGithubToken(newToken.trim());
      if (res.success) {
        toast.success(res.message ?? "GitHub token replaced successfully");
        setNewToken("");
        setShowRotateForm(false);
        checkStatus();
      } else {
        toast.error(res.error ?? "Token validation failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to replace token");
    } finally {
      setRotating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-5 rounded-xl border border-border/50 bg-bg-card text-center text-text-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Checking token status...
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl border border-border/50 bg-bg-card space-y-4">
      {/* Current status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {status === "valid" ? (
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          ) : status === "expired" ? (
            <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
          ) : status === "missing" ? (
            <XCircle className="w-5 h-5 text-error shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-text-muted shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium">
              {status === "valid"
                ? "Token is valid"
                : status === "expired"
                  ? "Token is expired or revoked"
                  : status === "missing"
                    ? "No token configured"
                    : "Unable to verify token"}
            </p>
            {user && (
              <p className="text-xs text-text-muted">
                Authenticated as <span className="font-medium text-text">{user.login}</span>
                {user.name && ` (${user.name})`}
              </p>
            )}
            {source === "github_app" && (
              <p className="text-xs text-text-muted">Using GitHub App integration</p>
            )}
            {message && !user && <p className="text-xs text-text-muted">{message}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={checkStatus}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-text-muted hover:bg-bg-hover transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          {source !== "github_app" && (
            <button
              onClick={() => setShowRotateForm(!showRotateForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
            >
              <KeyRound className="w-3 h-3" />
              {status === "missing" ? "Add Token" : "Replace Token"}
            </button>
          )}
        </div>
      </div>

      {/* Expired/missing warning */}
      {(status === "expired" || status === "missing") && (
        <div
          className={`flex items-start gap-2 p-3 rounded-lg text-xs ${
            status === "expired"
              ? "bg-warning/10 border border-warning/20 text-warning"
              : "bg-error/10 border border-error/20 text-error"
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">
              {status === "expired"
                ? "Your GitHub token has expired or been revoked"
                : "No GitHub token is configured"}
            </p>
            <p className="mt-0.5 opacity-70">
              PR watching, issue sync, and repo detection require a valid GitHub token. Replace it
              below to restore these features.
            </p>
          </div>
        </div>
      )}

      {/* Rotation form */}
      {showRotateForm && (
        <div className="space-y-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <p className="text-xs text-text-muted">
            Enter a new GitHub Personal Access Token. The token will be validated before replacing
            the existing one.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = e.clipboardData.getData("text").trim();
                if (pasted) setNewToken(pasted);
              }}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="flex-1 px-3 py-2 rounded-lg bg-bg border border-border text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
            <button
              onClick={handleRotate}
              disabled={!newToken.trim() || rotating}
              className="px-4 py-2 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary-hover disabled:opacity-50 whitespace-nowrap"
            >
              {rotating ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Validating...
                </span>
              ) : (
                "Validate & Save"
              )}
            </button>
          </div>
          <button
            onClick={() => {
              setShowRotateForm(false);
              setNewToken("");
            }}
            className="text-xs text-text-muted hover:text-text"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function formatInstallCount(count: number): string {
  if (count >= 1_000_000) {
    const val = count / 1_000_000;
    return val % 1 === 0 ? `${val}M` : `${val.toFixed(1)}M`;
  }
  if (count >= 1_000) {
    const val = count / 1_000;
    return val % 1 === 0 ? `${val}K` : `${val.toFixed(1)}K`;
  }
  return String(count);
}

function isMarketplaceSource(source: string): boolean {
  return source.includes("/");
}

function MarketplaceTab() {
  const [query, setQuery] = useState("");
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadSkills = () => {
    setLoading(true);
    api
      .listMarketplaceSkills()
      .then((res) => setSkills(res.skills))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const filteredSkills = skills.filter((skill) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      (skill.name && skill.name.toLowerCase().includes(q)) ||
      (skill.source && skill.source.toLowerCase().includes(q))
    );
  });

  const handleInstall = async (id: string) => {
    setInstalling(id);
    try {
      const res = await api.installMarketplaceSkill(id);
      setSkills((prev) => prev.map((s) => (s.id === id ? res.skill : s)));
      toast.success("Skill installed");
    } catch (err) {
      toast.error("Install failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setInstalling(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMarketplaceSkill(id);
      setSkills((prev) => prev.filter((s) => s.id !== id));
      toast.success("Marketplace skill removed");
    } catch (err) {
      toast.error("Failed to remove skill", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.syncMarketplaceSkills();
      toast.success(`Added ${res.added}, updated ${res.updated} skills`);
      loadSkills();
    } catch (err) {
      toast.error("Sync failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with sync button */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-text-muted flex items-center gap-2">
            <Package className="w-4 h-4" />
            Marketplace Skills
          </h2>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Sync from skills.sh
          </button>
        </div>

        <div className="p-5 rounded-xl border border-border/50 bg-bg-card space-y-4">
          {/* Search box - filters locally */}
          <div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter skills by name or source..."
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
          </div>

          {loading ? (
            <div className="text-center text-text-muted text-sm py-8">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading...
            </div>
          ) : skills.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Package className="w-8 h-8 text-text-muted/40 mx-auto" />
              <p className="text-sm text-text-muted">No skills synced yet.</p>
              <p className="text-xs text-text-muted/60">
                Click <strong>Sync from skills.sh</strong> to fetch the skills.sh catalog.
              </p>
            </div>
          ) : filteredSkills.length === 0 ? (
            <p className="text-xs text-text-muted/60 text-center py-4">
              No skills match &quot;{query}&quot;
            </p>
          ) : (
            <div className="space-y-2">
              {filteredSkills.map((skill) => {
                const isInstalled = !!skill.installed;
                const isFromMarketplace = isMarketplaceSource(skill.source || "");
                return (
                  <div
                    key={skill.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-bg"
                  >
                    <Package className="w-4 h-4 text-text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold">{skill.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-text-muted/10 text-text-muted font-mono">
                          {skill.source}
                        </span>
                        {isFromMarketplace ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                            marketplace
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-text-muted/10 text-text-muted font-medium">
                            custom
                          </span>
                        )}
                        {isInstalled ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success font-medium">
                            installed
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-text-muted/10 text-text-muted font-medium">
                            catalog
                          </span>
                        )}
                      </div>
                      {skill.description && (
                        <p className="text-xs text-text-muted mt-0.5 truncate">
                          {skill.description}
                        </p>
                      )}
                    </div>
                    {skill.installs != null && skill.installs > 0 && (
                      <div className="flex items-center gap-1 text-xs text-text-muted shrink-0">
                        <Download className="w-3 h-3" />
                        {formatInstallCount(skill.installs)} installs
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isInstalled && (
                        <button
                          onClick={() => handleInstall(skill.id)}
                          disabled={installing === skill.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
                        >
                          {installing === skill.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          Install
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(skill.id)}
                        className="text-text-muted hover:text-error shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SkillSetsTab() {
  const [skillSets, setSkillSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingSkillTo, setAddingSkillTo] = useState<string | null>(null);
  const [availableCustomSkills, setAvailableCustomSkills] = useState<any[]>([]);
  const [availableMarketplaceSkills, setAvailableMarketplaceSkills] = useState<any[]>([]);

  useEffect(() => {
    loadSkillSets();
    api
      .listSkills("global")
      .then((res) => setAvailableCustomSkills(res.skills))
      .catch(() => {});
    api
      .listMarketplaceSkills()
      .then((res) => setAvailableMarketplaceSkills(res.skills))
      .catch(() => {});
  }, []);

  const loadSkillSets = async () => {
    try {
      const res = await api.listSkillSets();
      // Load items for each skill set
      const detailed = await Promise.all(
        res.skillSets.map(async (ss: any) => {
          try {
            const detail = await api.getSkillSet(ss.id);
            return detail.skillSet;
          } catch {
            return ss;
          }
        }),
      );
      setSkillSets(detailed);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      const res = await api.createSkillSet({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });
      const detail = await api.getSkillSet(res.skillSet.id);
      setSkillSets((prev) => [...prev, detail.skillSet]);
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      toast.success("Skill set created");
    } catch (err) {
      toast.error("Failed to create skill set", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleDeleteSet = async (id: string) => {
    try {
      await api.deleteSkillSet(id);
      setSkillSets((prev) => prev.filter((ss) => ss.id !== id));
      toast.success("Skill set deleted");
    } catch (err) {
      toast.error("Failed to delete skill set", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleAddItem = async (
    setId: string,
    skillType: "custom" | "marketplace",
    skillId: string,
  ) => {
    try {
      const res = await api.addSkillSetItem(setId, { skillType, skillId });
      setSkillSets((prev) =>
        prev.map((ss) =>
          ss.id === setId ? { ...ss, items: [...(ss.items || []), res.item] } : ss,
        ),
      );
      setAddingSkillTo(null);
      toast.success("Skill added to set");
    } catch (err) {
      toast.error("Failed to add skill", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleRemoveItem = async (setId: string, itemId: string) => {
    try {
      await api.removeSkillSetItem(setId, itemId);
      setSkillSets((prev) =>
        prev.map((ss) =>
          ss.id === setId
            ? { ...ss, items: (ss.items || []).filter((i: any) => i.id !== itemId) }
            : ss,
        ),
      );
      toast.success("Skill removed from set");
    } catch (err) {
      toast.error("Failed to remove skill", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-5 rounded-xl border border-border/50 bg-bg-card text-center text-text-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-text-muted flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Skill Sets
          </h2>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Skill Set
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="mb-4 p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Frontend Tools"
                  className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Description</label>
                <input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="A collection of frontend-related skills"
                  className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                  setNewDescription("");
                }}
                className="px-3 py-1.5 rounded-md text-xs text-text-muted hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary-hover"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {/* Skill set list */}
        {skillSets.length === 0 && !showCreate && (
          <div className="p-5 rounded-xl border border-border/50 bg-bg-card">
            <p className="text-xs text-text-muted/60 text-center py-4">
              No skill sets created yet. Skill sets let you group custom and marketplace skills
              together for easy assignment to repositories.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {skillSets.map((ss) => {
            const isExpanded = expandedId === ss.id;
            const items = ss.items || [];
            return (
              <div
                key={ss.id}
                className="rounded-xl border border-border/50 bg-bg-card overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center gap-3 p-4">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : ss.id)}
                    className="text-text-muted hover:text-text"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{ss.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-text-muted/10 text-text-muted">
                        {items.length} {items.length === 1 ? "skill" : "skills"}
                      </span>
                    </div>
                    {ss.description && (
                      <p className="text-xs text-text-muted mt-0.5 truncate">{ss.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteSet(ss.id)}
                    className="text-text-muted hover:text-error shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border/50 p-4 space-y-3">
                    {items.length > 0 && (
                      <div className="space-y-2">
                        {items.map((item: any) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-bg"
                          >
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <span className="text-sm">
                                {item.skillName || item.customSkillId || item.marketplaceSkillId}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  item.skillType === "marketplace"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-success/10 text-success"
                                }`}
                              >
                                {item.skillType}
                              </span>
                            </div>
                            <button
                              onClick={() => handleRemoveItem(ss.id, item.id)}
                              className="text-text-muted hover:text-error shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {items.length === 0 && addingSkillTo !== ss.id && (
                      <p className="text-xs text-text-muted/60 text-center py-2">
                        No skills in this set yet.
                      </p>
                    )}

                    {/* Add skill dropdown */}
                    {addingSkillTo === ss.id ? (
                      <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                        <p className="text-xs font-medium text-text-muted">
                          Select a skill to add:
                        </p>
                        {availableCustomSkills.length > 0 && (
                          <div>
                            <p className="text-[10px] text-text-muted/60 uppercase tracking-wider mb-1">
                              Custom Skills
                            </p>
                            <div className="space-y-1">
                              {availableCustomSkills
                                .filter(
                                  (cs) =>
                                    !items.some(
                                      (i: any) =>
                                        i.skillType === "custom" &&
                                        (i.customSkillId === cs.id || i.skillId === cs.id),
                                    ),
                                )
                                .map((cs) => (
                                  <button
                                    key={cs.id}
                                    onClick={() => handleAddItem(ss.id, "custom", cs.id)}
                                    className="w-full flex items-center gap-2 p-2 rounded-md text-left text-xs hover:bg-bg-hover transition-colors"
                                  >
                                    <Sparkles className="w-3 h-3 text-success shrink-0" />
                                    <span className="font-medium">/{cs.name}</span>
                                    {cs.description && (
                                      <span className="text-text-muted truncate">
                                        {cs.description}
                                      </span>
                                    )}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                        {availableMarketplaceSkills.length > 0 && (
                          <div>
                            <p className="text-[10px] text-text-muted/60 uppercase tracking-wider mb-1">
                              Marketplace Skills
                            </p>
                            <div className="space-y-1">
                              {availableMarketplaceSkills
                                .filter(
                                  (ms) =>
                                    !items.some(
                                      (i: any) =>
                                        i.skillType === "marketplace" &&
                                        (i.marketplaceSkillId === ms.id || i.skillId === ms.id),
                                    ),
                                )
                                .map((ms) => (
                                  <button
                                    key={ms.id}
                                    onClick={() => handleAddItem(ss.id, "marketplace", ms.id)}
                                    className="w-full flex items-center gap-2 p-2 rounded-md text-left text-xs hover:bg-bg-hover transition-colors"
                                  >
                                    <Package className="w-3 h-3 text-primary shrink-0" />
                                    <span className="font-medium">{ms.name}</span>
                                    {ms.description && (
                                      <span className="text-text-muted truncate">
                                        {ms.description}
                                      </span>
                                    )}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                        {availableCustomSkills.length === 0 &&
                          availableMarketplaceSkills.length === 0 && (
                            <p className="text-xs text-text-muted/60 text-center py-2">
                              No skills available. Create custom skills or install marketplace
                              skills first.
                            </p>
                          )}
                        <button
                          onClick={() => setAddingSkillTo(null)}
                          className="text-xs text-text-muted hover:text-text"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingSkillTo(ss.id)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Plus className="w-3 h-3" />
                        Add Skill
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

type SettingsTab = "general" | "marketplace" | "skill-sets";

export default function SettingsPage() {
  usePageTitle("Settings");
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotificationsEnabled(Notification.permission === "granted");
    }
    api
      .listTicketProviders()
      .then((res) => setProviders(res.providers))
      .catch(() => {});
  }, []);

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotificationsEnabled(result === "granted");
    if (result === "granted") {
      toast.success("Notifications enabled");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.syncTickets();
      toast.success(`Synced ${res.synced} tickets`);
    } catch (err) {
      toast.error("Sync failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSyncing(false);
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <Bot className="w-4 h-4" /> },
    { id: "marketplace", label: "Marketplace", icon: <Package className="w-4 h-4" /> },
    { id: "skill-sets", label: "Skill Sets", icon: <Layers className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-lg bg-bg-card border border-border/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-white"
                : "text-text-muted hover:text-text hover:bg-bg-hover"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === "general" && (
        <>
          {/* Optio Agent Settings */}
          <section>
            <h2 className="text-sm font-medium text-text-muted mb-3 flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Optio Agent Settings
            </h2>
            <OptioAgentSettings />
          </section>

          {/* Authentication */}
          <section>
            <h2 className="text-sm font-medium text-text-muted mb-3">Authentication</h2>
            <AuthenticationSettings />
          </section>

          {/* GitHub Token */}
          <section>
            <h2 className="text-sm font-medium text-text-muted mb-3 flex items-center gap-2">
              <Github className="w-4 h-4" />
              GitHub Token
            </h2>
            <GitHubTokenManager />
          </section>

          {/* Notifications */}
          <section>
            <h2 className="text-sm font-medium text-text-muted mb-3">Notifications</h2>
            <div className="p-5 rounded-xl border border-border/50 bg-bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-text-muted" />
                  <div>
                    <p className="text-sm">Browser Notifications</p>
                    <p className="text-xs text-text-muted">
                      Get notified when tasks complete or need attention
                    </p>
                  </div>
                </div>
                <button
                  onClick={requestNotifications}
                  disabled={notificationsEnabled}
                  className={`px-3 py-1.5 rounded-md text-xs ${
                    notificationsEnabled
                      ? "bg-success/10 text-success"
                      : "bg-primary text-white hover:bg-primary-hover"
                  }`}
                >
                  {notificationsEnabled ? "Enabled" : "Enable"}
                </button>
              </div>
            </div>
          </section>

          {/* Ticket Sync */}
          <section>
            <h2 className="text-sm font-medium text-text-muted mb-3">Ticket Integration</h2>
            <div className="p-5 rounded-xl border border-border/50 bg-bg-card space-y-3">
              <p className="text-xs text-text-muted">
                Sync issues labeled with{" "}
                <code className="px-1 py-0.5 bg-bg rounded text-primary">optio</code> from your
                configured ticket providers.
              </p>
              {providers.length > 0 ? (
                <div className="space-y-2">
                  {providers.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm">
                      <span
                        className={`w-2 h-2 rounded-full ${p.enabled ? "bg-success" : "bg-text-muted"}`}
                      />
                      <span className="capitalize">{p.source}</span>
                      <span className="text-xs text-text-muted">
                        {p.source === "github" &&
                          p.config?.owner &&
                          `${p.config.owner}/${p.config.repo}`}
                        {p.source === "notion" &&
                          p.config?.databaseId &&
                          `Database: ${p.config.databaseId}`}
                        {p.source === "linear" && p.config?.teamId && `Team: ${p.config.teamId}`}
                        {p.source === "jira" && p.config?.baseUrl && `${p.config.baseUrl}`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted">No ticket providers configured.</p>
              )}
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {syncing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Sync Now
              </button>
            </div>
          </section>

          {/* MCP Servers */}
          <section>
            <h2 className="text-sm font-medium text-text-muted mb-3 flex items-center gap-2">
              <Server className="w-4 h-4" />
              Global MCP Servers
            </h2>
            <GlobalMcpServers />
          </section>

          {/* Custom Skills */}
          <section>
            <h2 className="text-sm font-medium text-text-muted mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Global Custom Skills
            </h2>
            <GlobalSkills />
          </section>

          {/* Prompt Template */}
          <section>
            <h2 className="text-sm font-medium text-text-muted mb-3">
              Default Agent Prompt Template
            </h2>
            <PromptTemplateEditor />
          </section>

          {/* Default Code Review */}
          <section>
            <h2 className="text-sm font-medium text-text-muted mb-3">Default Code Review Agent</h2>
            <DefaultReviewEditor />
          </section>
        </>
      )}

      {/* Marketplace Tab */}
      {activeTab === "marketplace" && <MarketplaceTab />}

      {/* Skill Sets Tab */}
      {activeTab === "skill-sets" && <SkillSetsTab />}
    </div>
  );
}
