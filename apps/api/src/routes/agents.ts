import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as agentService from "../services/agent-service.js";
import { runtimeManifestSchema } from "./shared-schemas.js";

const createAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  agentType: z.enum(["claude-code", "codex", "copilot"]).optional(),
  model: z.string().optional(),
  contextWindow: z.string().optional(),
  thinking: z.boolean().optional(),
  effort: z.enum(["low", "medium", "high"]).optional(),
  imagePreset: z.string().optional(), // @deprecated
  customDockerfile: z.string().optional(), // @deprecated
  extraPackages: z.string().optional(), // @deprecated
  setupCommands: z.string().optional(), // @deprecated
  runtimeRequires: runtimeManifestSchema,
  maxTurns: z.number().int().positive().optional(),
  promptTemplate: z.string().optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  agentType: z.enum(["claude-code", "codex", "copilot"]).optional(),
  model: z.string().nullable().optional(),
  contextWindow: z.string().nullable().optional(),
  thinking: z.boolean().nullable().optional(),
  effort: z.enum(["low", "medium", "high"]).nullable().optional(),
  imagePreset: z.string().nullable().optional(), // @deprecated
  customDockerfile: z.string().nullable().optional(), // @deprecated
  extraPackages: z.string().nullable().optional(), // @deprecated
  setupCommands: z.string().nullable().optional(), // @deprecated
  runtimeRequires: runtimeManifestSchema.nullable(),
  maxTurns: z.number().int().positive().nullable().optional(),
  promptTemplate: z.string().nullable().optional(),
});

const mcpServerIdsSchema = z.object({
  mcpServerIds: z.array(z.string().uuid()),
});

const skillSetIdsSchema = z.object({
  skillSetIds: z.array(z.string().uuid()),
});

export async function agentRoutes(app: FastifyInstance) {
  // GET /api/agents — list all agents
  app.get("/api/agents", async (req, reply) => {
    const workspaceId = (req as any).user?.workspaceId ?? null;
    const agents = await agentService.listAgents(workspaceId);
    reply.send({ agents });
  });

  // GET /api/agents/:id — get single agent
  app.get("/api/agents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = await agentService.getAgent(id);
    if (!agent) return reply.status(404).send({ error: "Agent not found" });
    reply.send({ agent });
  });

  // POST /api/agents — create agent
  app.post("/api/agents", async (req, reply) => {
    const input = createAgentSchema.parse(req.body);
    const workspaceId = (req as any).user?.workspaceId ?? null;
    const agent = await agentService.createAgent(input, workspaceId);
    reply.status(201).send({ agent });
  });

  // PATCH /api/agents/:id — update agent
  app.patch("/api/agents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await agentService.getAgent(id);
    if (!existing) return reply.status(404).send({ error: "Agent not found" });
    const input = updateAgentSchema.parse(req.body);
    const agent = await agentService.updateAgent(id, input);
    reply.send({ agent });
  });

  // DELETE /api/agents/:id — delete agent
  app.delete("/api/agents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await agentService.getAgent(id);
    if (!existing) return reply.status(404).send({ error: "Agent not found" });
    await agentService.deleteAgent(id);
    reply.status(204).send();
  });

  // ── MCP Server associations ─────────────────────────────────────────────

  // GET /api/agents/:id/mcp-servers — list MCP server IDs
  app.get("/api/agents/:id/mcp-servers", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await agentService.getAgent(id);
    if (!existing) return reply.status(404).send({ error: "Agent not found" });
    const mcpServerIds = await agentService.getAgentMcpServerIds(id);
    reply.send({ mcpServerIds });
  });

  // PUT /api/agents/:id/mcp-servers — replace MCP server associations
  app.put("/api/agents/:id/mcp-servers", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await agentService.getAgent(id);
    if (!existing) return reply.status(404).send({ error: "Agent not found" });
    const { mcpServerIds } = mcpServerIdsSchema.parse(req.body);
    await agentService.setAgentMcpServerIds(id, mcpServerIds);
    reply.send({ mcpServerIds });
  });

  // ── Skill Set associations ──────────────────────────────────────────────

  // GET /api/agents/:id/skill-sets — list skill set IDs
  app.get("/api/agents/:id/skill-sets", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await agentService.getAgent(id);
    if (!existing) return reply.status(404).send({ error: "Agent not found" });
    const skillSetIds = await agentService.getAgentSkillSetIds(id);
    reply.send({ skillSetIds });
  });

  // PUT /api/agents/:id/skill-sets — replace skill set associations
  app.put("/api/agents/:id/skill-sets", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await agentService.getAgent(id);
    if (!existing) return reply.status(404).send({ error: "Agent not found" });
    const { skillSetIds } = skillSetIdsSchema.parse(req.body);
    await agentService.setAgentSkillSetIds(id, skillSetIds);
    reply.send({ skillSetIds });
  });
}
