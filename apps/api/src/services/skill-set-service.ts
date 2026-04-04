import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  skillSets,
  skillSetItems,
  repoSkillSets,
  customSkills,
  marketplaceSkills,
} from "../db/schema.js";
import type { SkillSetConfig, SkillSetItemConfig } from "@optio/shared";

// ── Skill Set CRUD ──────────────────────────────────────────────────────────

export async function listSkillSets(workspaceId?: string | null): Promise<SkillSetConfig[]> {
  const rows = workspaceId
    ? await db.select().from(skillSets).where(eq(skillSets.workspaceId, workspaceId))
    : await db.select().from(skillSets);

  // Enrich with items
  const result: SkillSetConfig[] = [];
  for (const row of rows) {
    const items = await getSkillSetItems(row.id);
    result.push({ ...row, items } as SkillSetConfig);
  }
  return result;
}

export async function getSkillSet(id: string): Promise<SkillSetConfig | null> {
  const [row] = await db.select().from(skillSets).where(eq(skillSets.id, id));
  if (!row) return null;
  const items = await getSkillSetItems(id);
  return { ...row, items } as SkillSetConfig;
}

export async function createSkillSet(input: {
  name: string;
  description?: string;
  scope?: string;
  workspaceId?: string | null;
}): Promise<SkillSetConfig> {
  const [row] = await db
    .insert(skillSets)
    .values({
      name: input.name,
      description: input.description ?? null,
      scope: input.scope ?? "global",
      workspaceId: input.workspaceId ?? null,
    })
    .returning();
  return { ...row, items: [] } as SkillSetConfig;
}

export async function updateSkillSet(
  id: string,
  input: { name?: string; description?: string | null },
): Promise<SkillSetConfig | null> {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;

  const [row] = await db.update(skillSets).set(updates).where(eq(skillSets.id, id)).returning();
  if (!row) return null;
  const items = await getSkillSetItems(id);
  return { ...row, items } as SkillSetConfig;
}

export async function deleteSkillSet(id: string): Promise<void> {
  // Cascades to skill_set_items and repo_skill_sets via FK
  await db.delete(skillSets).where(eq(skillSets.id, id));
}

// ── Skill Set Items ─────────────────────────────────────────────────────────

async function getSkillSetItems(skillSetId: string): Promise<SkillSetItemConfig[]> {
  const items = await db
    .select()
    .from(skillSetItems)
    .where(eq(skillSetItems.skillSetId, skillSetId));

  // Enrich with skill names
  const enriched: SkillSetItemConfig[] = [];
  for (const item of items) {
    let skillName: string | undefined;
    let skillDescription: string | null | undefined;

    if (item.skillType === "custom") {
      const [skill] = await db
        .select({ name: customSkills.name, description: customSkills.description })
        .from(customSkills)
        .where(eq(customSkills.id, item.skillId));
      skillName = skill?.name;
      skillDescription = skill?.description;
    } else if (item.skillType === "marketplace") {
      const [skill] = await db
        .select({ name: marketplaceSkills.name, description: marketplaceSkills.description })
        .from(marketplaceSkills)
        .where(eq(marketplaceSkills.id, item.skillId));
      skillName = skill?.name;
      skillDescription = skill?.description;
    }

    enriched.push({
      ...item,
      skillType: item.skillType as "custom" | "marketplace",
      skillName,
      skillDescription,
    } as SkillSetItemConfig);
  }

  return enriched;
}

export async function addSkillSetItem(
  skillSetId: string,
  skillType: "custom" | "marketplace",
  skillId: string,
): Promise<SkillSetItemConfig> {
  const [item] = await db
    .insert(skillSetItems)
    .values({ skillSetId, skillType, skillId })
    .returning();

  await db.update(skillSets).set({ updatedAt: new Date() }).where(eq(skillSets.id, skillSetId));

  return item as SkillSetItemConfig;
}

export async function removeSkillSetItem(itemId: string): Promise<void> {
  const [item] = await db
    .select({ skillSetId: skillSetItems.skillSetId })
    .from(skillSetItems)
    .where(eq(skillSetItems.id, itemId));

  await db.delete(skillSetItems).where(eq(skillSetItems.id, itemId));

  if (item) {
    await db
      .update(skillSets)
      .set({ updatedAt: new Date() })
      .where(eq(skillSets.id, item.skillSetId));
  }
}

// ── Repo ↔ Skill Set Assignments ────────────────────────────────────────────

export async function getRepoSkillSets(repoUrl: string): Promise<SkillSetConfig[]> {
  const assignments = await db
    .select({ skillSetId: repoSkillSets.skillSetId })
    .from(repoSkillSets)
    .where(eq(repoSkillSets.repoUrl, repoUrl));

  if (assignments.length === 0) return [];

  const setIds = assignments.map((a) => a.skillSetId);
  const sets = await db.select().from(skillSets).where(inArray(skillSets.id, setIds));

  const result: SkillSetConfig[] = [];
  for (const s of sets) {
    const items = await getSkillSetItems(s.id);
    result.push({ ...s, items } as SkillSetConfig);
  }
  return result;
}

export async function assignSkillSetToRepo(repoUrl: string, skillSetId: string): Promise<void> {
  // Check if already assigned
  const existing = await db
    .select()
    .from(repoSkillSets)
    .where(and(eq(repoSkillSets.repoUrl, repoUrl), eq(repoSkillSets.skillSetId, skillSetId)));

  if (existing.length === 0) {
    await db.insert(repoSkillSets).values({ repoUrl, skillSetId });
  }
}

export async function removeSkillSetFromRepo(repoUrl: string, skillSetId: string): Promise<void> {
  await db
    .delete(repoSkillSets)
    .where(and(eq(repoSkillSets.repoUrl, repoUrl), eq(repoSkillSets.skillSetId, skillSetId)));
}

// ── Resolve all skills for a repo (via skill sets) ──────────────────────────

export async function getSkillsFromSkillSets(repoUrl: string): Promise<
  Array<{
    name: string;
    prompt: string;
    referenceFiles?: Array<{ path: string; content: string }> | null;
  }>
> {
  const sets = await getRepoSkillSets(repoUrl);
  const skills: Array<{
    name: string;
    prompt: string;
    referenceFiles?: Array<{ path: string; content: string }> | null;
  }> = [];
  const seen = new Set<string>();

  for (const s of sets) {
    if (!s.items) continue;
    for (const item of s.items) {
      if (item.skillType === "custom") {
        const [skill] = await db
          .select()
          .from(customSkills)
          .where(eq(customSkills.id, item.skillId));
        if (skill && skill.enabled && !seen.has(skill.name)) {
          seen.add(skill.name);
          skills.push({ name: skill.name, prompt: skill.prompt });
        }
      } else if (item.skillType === "marketplace") {
        const [skill] = await db
          .select()
          .from(marketplaceSkills)
          .where(eq(marketplaceSkills.id, item.skillId));
        if (skill && !seen.has(skill.name)) {
          seen.add(skill.name);
          skills.push({
            name: skill.name,
            prompt: skill.prompt,
            referenceFiles: skill.referenceFiles as Array<{ path: string; content: string }> | null,
          });
        }
      }
    }
  }

  return skills;
}
