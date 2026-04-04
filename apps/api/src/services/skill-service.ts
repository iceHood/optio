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

  // Also include skills from skill sets assigned to this repo
  try {
    const { getSkillsFromSkillSets } = await import("./skill-set-service.js");
    const skillSetSkills = await getSkillsFromSkillSets(repoUrl);
    for (const skill of skillSetSkills) {
      if (!byName.has(skill.name)) {
        // Skill set skills have lower priority than direct assignments
        byName.set(skill.name, {
          id: "",
          name: skill.name,
          prompt: skill.prompt,
          scope: "skill-set",
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _referenceFiles: skill.referenceFiles,
        } as CustomSkillConfig & { _referenceFiles?: unknown });
      }
    }
  } catch {
    // skill-set-service not available (e.g. tables not migrated yet)
  }

  return Array.from(byName.values());
}

/**
 * Build setup files for custom skills to be written to .claude/commands/ in the worktree.
 * Also includes reference files from marketplace skills (via skill sets).
 */
export function buildSkillSetupFiles(
  skills: CustomSkillConfig[],
): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  for (const skill of skills) {
    files.push({
      path: `.claude/commands/${skill.name}.md`,
      content: skill.prompt,
    });
    // Include reference files from marketplace skills (attached via _referenceFiles)
    const refs = (skill as any)._referenceFiles as
      | Array<{ path: string; content: string }>
      | null
      | undefined;
    if (refs) {
      for (const ref of refs) {
        files.push({
          path: `.claude/commands/${skill.name}/${ref.path}`,
          content: ref.content,
        });
      }
    }
  }
  return files;
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
