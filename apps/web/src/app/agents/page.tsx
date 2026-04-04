"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePageTitle } from "@/hooks/use-page-title";
import { api } from "@/lib/api-client";
import Link from "next/link";
import { Loader2, Bot, Plus, ChevronRight, Cpu, Sparkles } from "lucide-react";
import { toast } from "sonner";

const AGENT_TYPE_LABELS: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  copilot: "Copilot",
};

const MODEL_LABELS: Record<string, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
};

export default function AgentsPage() {
  usePageTitle("Agents");
  const router = useRouter();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    agentType: "claude-code",
    model: "sonnet",
    effort: "high",
    maxTurns: "",
    imagePreset: "",
  });

  const loadAgents = () => {
    api
      .listAgents()
      .then((res) => setAgents(res.agents))
      .catch(() => toast.error("Failed to load agents"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.createAgent({
        name: form.name,
        description: form.description || undefined,
        agentType: form.agentType,
        model: form.model || undefined,
        effort: form.effort || undefined,
        maxTurns: form.maxTurns ? parseInt(form.maxTurns) : undefined,
      });
      toast.success("Agent created — configure MCP servers and skills");
      router.push(`/agents/${res.agent.id}`);
    } catch (err: any) {
      toast.error("Failed to create agent", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-white text-sm hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Agent
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-5 rounded-xl border border-border/50 bg-bg-card space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Senior Coder"
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Agent Type</label>
              <select
                value={form.agentType}
                onChange={(e) => setForm((f) => ({ ...f, agentType: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
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
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What this agent specializes in"
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Model</label>
              <select
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
              >
                <option value="">Default</option>
                <option value="opus">Opus</option>
                <option value="sonnet">Sonnet</option>
                <option value="haiku">Haiku</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Effort</label>
              <select
                value={form.effort}
                onChange={(e) => setForm((f) => ({ ...f, effort: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
              >
                <option value="">Default</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Max Turns</label>
              <input
                type="number"
                value={form.maxTurns}
                onChange={(e) => setForm((f) => ({ ...f, maxTurns: e.target.value }))}
                placeholder="250"
                min={1}
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-md text-sm text-text-muted hover:text-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-primary text-white text-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {submitting ? "Creating..." : "Create Agent"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-12 text-text-muted border border-dashed border-border rounded-lg">
          <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No agents defined</p>
          <p className="text-xs mt-1">
            Create an agent to define a reusable AI configuration — model, tools, skills, and
            limits.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent: any) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="flex items-center justify-between p-5 rounded-xl border border-border/50 bg-bg-card hover:bg-bg-hover transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Bot className="w-5 h-5 text-text-muted shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{agent.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {AGENT_TYPE_LABELS[agent.agentType] ?? agent.agentType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                    {agent.model && (
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {MODEL_LABELS[agent.model] ?? agent.model}
                      </span>
                    )}
                    {agent.effort && <span>Effort: {agent.effort}</span>}
                    {agent.maxTurns && <span>Max turns: {agent.maxTurns}</span>}
                    {agent.imagePreset && (
                      <span className="flex items-center gap-1">
                        <Cpu className="w-3 h-3" />
                        {agent.imagePreset}
                      </span>
                    )}
                    {agent.description && (
                      <span className="truncate max-w-[200px]">{agent.description}</span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
