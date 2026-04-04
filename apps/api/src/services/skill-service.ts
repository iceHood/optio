import { eq, and, or, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { customSkills } from "../db/schema.js";
import type { CustomSkillConfig } from "@optio/shared";

export async function listSkills(
  scope?: string,
  workspaceId?: string | null,
): Promise<CustomSkillConfig[]> {
  const conditions = [];
  if (scope) conditions.push(eq(customSkills.scope, scope));
  if (workspaceId) {
    conditions.push(
      or(eq(customSkills.workspaceId, workspaceId), isNull(customSkills.workspaceId))!,
    );
  }

  const query =
    conditions.length > 0
      ? db
          .select()
          .from(customSkills)
          .where(and(...conditions))
      : db.select().from(customSkills);
  const rows = await query;
  return rows.map(mapRow);
}

export async function getSkill(id: string): Promise<CustomSkillConfig | null> {
  const [row] = await db.select().from(customSkills).where(eq(customSkills.id, id));
  return row ? mapRow(row) : null;
}

export async function createSkill(
  input: {
    name: string;
    description?: string;
    prompt: string;
    repoUrl?: string;
    enabled?: boolean;
  },
  workspaceId?: string | null,
): Promise<CustomSkillConfig> {
  const [row] = await db
    .insert(customSkills)
    .values({
      name: input.name,
      description: input.description ?? undefined,
      prompt: input.prompt,
      scope: input.repoUrl ?? "global",
      repoUrl: input.repoUrl ?? undefined,
      workspaceId: workspaceId ?? undefined,
      enabled: input.enabled ?? true,
    })
    .returning();
  return mapRow(row);
}

export async function updateSkill(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    prompt?: string;
    enabled?: boolean;
  },
): Promise<CustomSkillConfig> {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.prompt !== undefined) updates.prompt = input.prompt;
  if (input.enabled !== undefined) updates.enabled = input.enabled;

  const [row] = await db
    .update(customSkills)
    .set(updates)
    .where(eq(customSkills.id, id))
    .returning();
  return mapRow(row);
}

export async function deleteSkill(id: string): Promise<void> {
  await db.delete(customSkills).where(eq(customSkills.id, id));
}

/**
 * Get all enabled skills for a task (global + repo-scoped + skill sets).
 * Priority: repo direct > skill set > global. Deduped by name.
 */
export async function getSkillsForTask(
  repoUrl: string,
  workspaceId?: string | null,
): Promise<CustomSkillConfig[]> {
  const conditions = [
    eq(customSkills.enabled, true),
    or(eq(customSkills.scope, "global"), eq(customSkills.scope, repoUrl))!,
  ];
  if (workspaceId) {
    conditions.push(
      or(eq(customSkills.workspaceId, workspaceId), isNull(customSkills.workspaceId))!,
    );
  }

  const rows = await db
    .select()
    .from(customSkills)
    .where(and(...conditions));

  // Repo-scoped skills override global ones with the same name
  const byName = new Map<string, CustomSkillConfig>();
  for (const row of rows) {
    const config = mapRow(row);
    const existing = byName.get(config.name);
    if (!existing || (config.scope !== "global" && existing.scope === "global")) {
      byName.set(config.name, config);
    }
  }

  // Also include custom skills from skill sets assigned to this repo
  // (Marketplace skills are handled separately via npx skills add in the container)
  try {
    const { getCustomSkillsFromSkillSets } = await import("./skill-set-service.js");
    const skillSetSkills = await getCustomSkillsFromSkillSets(repoUrl);
    for (const skill of skillSetSkills) {
      if (!byName.has(skill.name)) {
        byName.set(skill.name, {
          id: "",
          name: skill.name,
          prompt: skill.prompt,
          scope: "skill-set",
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  } catch {
    // skill-set-service not available (e.g. tables not migrated yet)
  }

  return Array.from(byName.values());
}

/**
 * Get skills for a task that uses an agent profile.
 * Merges agent's skill sets with repo/global skills.
 * Agent skill set skills override repo-scoped, which override global.
 */
export async function getSkillsForAgent(
  agentId: string,
  repoUrl: string,
  workspaceId?: string | null,
): Promise<CustomSkillConfig[]> {
  // First get the base repo/global skills
  const base = await getSkillsForTask(repoUrl, workspaceId);
  const byName = new Map<string, CustomSkillConfig>();
  for (const s of base) {
    byName.set(s.name, s);
  }

  // Fetch agent's skill set IDs and get their skills
  try {
    const { getAgentSkillSetIds } = await import("./agent-service.js");
    const { getCustomSkillsFromSkillSetIds } = await import("./skill-set-service.js");
    const skillSetIds = await getAgentSkillSetIds(agentId);
    if (skillSetIds.length > 0) {
      const agentSkills = await getCustomSkillsFromSkillSetIds(skillSetIds);
      for (const skill of agentSkills) {
        // Agent skills override by name
        byName.set(skill.name, {
          id: "",
          name: skill.name,
          prompt: skill.prompt,
          scope: "agent",
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  } catch {
    // agent or skill-set service not available
  }

  return Array.from(byName.values());
}

/**
 * Build setup files for custom skills.
 * If the skill has a `files` array (from zip/skill upload), all files are included.
 * Otherwise, the prompt is written as a single .claude/commands/{name}.md file.
 */
export function buildSkillSetupFiles(
  skills: CustomSkillConfig[],
): Array<{ path: string; content: string }> {
  const result: Array<{ path: string; content: string }> = [];
  for (const skill of skills) {
    const skillFiles = (skill as any).files as Array<{ path: string; content: string }> | null;
    if (skillFiles && skillFiles.length > 0) {
      // Full skill archive: write all files under the skill's directory
      for (const f of skillFiles) {
        result.push({
          path: `.claude/commands/${skill.name}/${f.path}`,
          content: f.content,
        });
      }
    } else {
      // Simple text skill: single markdown file
      result.push({
        path: `.claude/commands/${skill.name}.md`,
        content: skill.prompt,
      });
    }
  }
  return result;
}

function mapRow(row: typeof customSkills.$inferSelect): CustomSkillConfig {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    prompt: row.prompt,
    scope: row.scope,
    repoUrl: row.repoUrl,
    workspaceId: row.workspaceId,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
