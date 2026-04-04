import { eq, and, or, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { agents, agentMcpServers, agentSkillSets } from "../db/schema.js";
import type { AgentProfile, CreateAgentInput, UpdateAgentInput } from "@optio/shared";

// ── List agents ─────────────────────────────────────────────────────────────

export async function listAgents(workspaceId?: string | null): Promise<AgentProfile[]> {
  const conditions = workspaceId
    ? [or(eq(agents.workspaceId, workspaceId), isNull(agents.workspaceId))!]
    : [];

  const rows =
    conditions.length > 0
      ? await db
          .select()
          .from(agents)
          .where(and(...conditions))
      : await db.select().from(agents);

  return rows.map(mapRow);
}

// ── Get agent by ID ─────────────────────────────────────────────────────────

export async function getAgent(id: string): Promise<AgentProfile | null> {
  const [row] = await db.select().from(agents).where(eq(agents.id, id));
  return row ? mapRow(row) : null;
}

// ── Create agent ────────────────────────────────────────────────────────────

export async function createAgent(
  input: CreateAgentInput,
  workspaceId?: string | null,
): Promise<AgentProfile> {
  const [row] = await db
    .insert(agents)
    .values({
      name: input.name,
      description: input.description,
      agentType: input.agentType ?? "claude-code",
      model: input.model,
      contextWindow: input.contextWindow,
      thinking: input.thinking,
      effort: input.effort,
      imagePreset: input.imagePreset,
      customDockerfile: input.customDockerfile,
      extraPackages: input.extraPackages,
      setupCommands: input.setupCommands,
      maxTurns: input.maxTurns,
      promptTemplate: input.promptTemplate,
      workspaceId: workspaceId ?? undefined,
    })
    .returning();
  return mapRow(row);
}

// ── Update agent ────────────────────────────────────────────────────────────

export async function updateAgent(id: string, input: UpdateAgentInput): Promise<AgentProfile> {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.agentType !== undefined) updates.agentType = input.agentType;
  if (input.model !== undefined) updates.model = input.model;
  if (input.contextWindow !== undefined) updates.contextWindow = input.contextWindow;
  if (input.thinking !== undefined) updates.thinking = input.thinking;
  if (input.effort !== undefined) updates.effort = input.effort;
  if (input.imagePreset !== undefined) updates.imagePreset = input.imagePreset;
  if (input.customDockerfile !== undefined) updates.customDockerfile = input.customDockerfile;
  if (input.extraPackages !== undefined) updates.extraPackages = input.extraPackages;
  if (input.setupCommands !== undefined) updates.setupCommands = input.setupCommands;
  if (input.maxTurns !== undefined) updates.maxTurns = input.maxTurns;
  if (input.promptTemplate !== undefined) updates.promptTemplate = input.promptTemplate;

  const [row] = await db.update(agents).set(updates).where(eq(agents.id, id)).returning();
  return mapRow(row);
}

// ── Delete agent ────────────────────────────────────────────────────────────

export async function deleteAgent(id: string): Promise<void> {
  await db.delete(agents).where(eq(agents.id, id));
}

// ── MCP Server associations ─────────────────────────────────────────────────

export async function getAgentMcpServerIds(agentId: string): Promise<string[]> {
  const rows = await db
    .select({ mcpServerId: agentMcpServers.mcpServerId })
    .from(agentMcpServers)
    .where(eq(agentMcpServers.agentId, agentId));
  return rows.map((r) => r.mcpServerId);
}

export async function setAgentMcpServerIds(agentId: string, mcpServerIds: string[]): Promise<void> {
  await db.delete(agentMcpServers).where(eq(agentMcpServers.agentId, agentId));
  if (mcpServerIds.length > 0) {
    await db
      .insert(agentMcpServers)
      .values(mcpServerIds.map((mcpServerId) => ({ agentId, mcpServerId })));
  }
}

// ── Skill Set associations ──────────────────────────────────────────────────

export async function getAgentSkillSetIds(agentId: string): Promise<string[]> {
  const rows = await db
    .select({ skillSetId: agentSkillSets.skillSetId })
    .from(agentSkillSets)
    .where(eq(agentSkillSets.agentId, agentId));
  return rows.map((r) => r.skillSetId);
}

export async function setAgentSkillSetIds(agentId: string, skillSetIds: string[]): Promise<void> {
  await db.delete(agentSkillSets).where(eq(agentSkillSets.agentId, agentId));
  if (skillSetIds.length > 0) {
    await db
      .insert(agentSkillSets)
      .values(skillSetIds.map((skillSetId) => ({ agentId, skillSetId })));
  }
}

// ── Row mapper ──────────────────────────────────────────────────────────────

function mapRow(row: typeof agents.$inferSelect): AgentProfile {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    agentType: row.agentType,
    model: row.model,
    contextWindow: row.contextWindow,
    thinking: row.thinking,
    effort: row.effort,
    imagePreset: row.imagePreset,
    customDockerfile: row.customDockerfile,
    extraPackages: row.extraPackages,
    setupCommands: row.setupCommands,
    maxTurns: row.maxTurns,
    promptTemplate: row.promptTemplate,
    workspaceId: row.workspaceId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
