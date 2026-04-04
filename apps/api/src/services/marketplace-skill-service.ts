import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { marketplaceSkills } from "../db/schema.js";
import { logger } from "../logger.js";
import type { MarketplaceSkillConfig } from "@optio/shared";

// ── Fetch entire skills.sh catalog ──────────────────────────────────────────

interface SkillsCatalogEntry {
  source: string; // "owner/repo"
  skillId: string; // skill name within repo
  name: string;
  installs: number;
}

/**
 * Fetch the full skills.sh catalog by scraping the RSC data from the homepage.
 */
export async function fetchSkillsCatalog(): Promise<SkillsCatalogEntry[]> {
  const res = await fetch("https://skills.sh/", {
    headers: { "User-Agent": "Optio" },
  });
  if (!res.ok) throw new Error(`Failed to fetch skills.sh: ${res.status}`);
  const html = await res.text();

  const escapedMatch = html.match(/initialSkills\\":\s*(\[.*?\])/);
  if (escapedMatch) {
    const unescaped = escapedMatch[1].replace(/\\"/g, '"');
    return JSON.parse(unescaped) as SkillsCatalogEntry[];
  }

  const plainMatch = html.match(/"initialSkills":\s*(\[.*?\])/);
  if (plainMatch) {
    return JSON.parse(plainMatch[1]) as SkillsCatalogEntry[];
  }

  throw new Error("Could not find initialSkills in skills.sh response");
}

/**
 * Sync entire skills.sh catalog into marketplace_skills table.
 * Only stores metadata (name, source, installs). No SKILL.md download.
 * Actual skill installation happens in the container via `npx skills add`.
 */
export async function syncCatalog(
  workspaceId?: string | null,
): Promise<{ added: number; updated: number; total: number }> {
  const catalog = await fetchSkillsCatalog();
  let added = 0;
  let updated = 0;

  for (const entry of catalog) {
    const sourceKey = `${entry.source}@${entry.skillId}`;
    const [existing] = await db
      .select()
      .from(marketplaceSkills)
      .where(eq(marketplaceSkills.source, sourceKey));

    if (existing) {
      await db
        .update(marketplaceSkills)
        .set({
          name: entry.name,
          installs: entry.installs,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(marketplaceSkills.id, existing.id));
      updated++;
    } else {
      await db.insert(marketplaceSkills).values({
        source: sourceKey,
        skillPath: `${entry.skillId}/SKILL.md`,
        name: entry.name,
        description: `from ${entry.source}`,
        prompt: "",
        installs: entry.installs,
        installed: false,
        lastSyncedAt: new Date(),
        workspaceId: workspaceId ?? null,
      });
      added++;
    }
  }

  logger.info({ added, updated, total: catalog.length }, "Synced skills.sh catalog");
  return { added, updated, total: catalog.length };
}

// ── Search local catalog ────────────────────────────────────────────────────

export async function searchMarketplace(query: string): Promise<MarketplaceSkillConfig[]> {
  const all = await db.select().from(marketplaceSkills);
  const q = query.toLowerCase();
  const filtered = q
    ? all.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.source.toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q),
      )
    : all;
  filtered.sort((a, b) => (b.installs ?? 0) - (a.installs ?? 0));
  return filtered as MarketplaceSkillConfig[];
}

// ── Install / Uninstall (just toggle flag in DB) ────────────────────────────

/**
 * Mark a marketplace skill as "installed". The actual installation
 * happens in the worker container via `npx skills add <source>`.
 */
export async function installSkill(id: string): Promise<MarketplaceSkillConfig> {
  const [row] = await db
    .update(marketplaceSkills)
    .set({ installed: true, updatedAt: new Date() })
    .where(eq(marketplaceSkills.id, id))
    .returning();
  if (!row) throw new Error("Skill not found");
  logger.info({ source: row.source, name: row.name }, "Marked marketplace skill as installed");
  return row as MarketplaceSkillConfig;
}

export async function uninstallSkill(id: string): Promise<void> {
  await db
    .update(marketplaceSkills)
    .set({ installed: false, updatedAt: new Date() })
    .where(eq(marketplaceSkills.id, id));
}

// ── List / Get ──────────────────────────────────────────────────────────────

export async function listMarketplaceSkills(
  workspaceId?: string | null,
): Promise<MarketplaceSkillConfig[]> {
  const rows = workspaceId
    ? await db
        .select()
        .from(marketplaceSkills)
        .where(eq(marketplaceSkills.workspaceId, workspaceId))
    : await db.select().from(marketplaceSkills);
  return rows as MarketplaceSkillConfig[];
}

export async function listInstalledMarketplaceSkills(
  workspaceId?: string | null,
): Promise<MarketplaceSkillConfig[]> {
  const all = await listMarketplaceSkills(workspaceId);
  return all.filter((s) => s.installed);
}

export async function deleteMarketplaceSkill(id: string): Promise<void> {
  await db.delete(marketplaceSkills).where(eq(marketplaceSkills.id, id));
}

/**
 * Get the `npx skills add` commands for all installed marketplace skills
 * assigned to a repo (via skill sets). Used by the exec script.
 */
export async function getInstallCommands(repoUrl: string): Promise<string[]> {
  const { getRepoSkillSets } = await import("./skill-set-service.js");
  const sets = await getRepoSkillSets(repoUrl);
  const commands: string[] = [];
  const seen = new Set<string>();

  for (const s of sets) {
    if (!s.items) continue;
    for (const item of s.items) {
      if (item.skillType !== "marketplace") continue;
      const [skill] = await db
        .select()
        .from(marketplaceSkills)
        .where(eq(marketplaceSkills.id, item.skillId));
      if (!skill || seen.has(skill.source)) continue;
      seen.add(skill.source);
      // source format: "owner/repo@skillName" → npx skills add owner/repo --skill skillName
      const [ownerRepo, skillName] = skill.source.split("@");
      if (ownerRepo && skillName) {
        commands.push(
          `npx -y skills add ${ownerRepo} --skill ${skillName} --agent claude-code -y 2>/dev/null || true`,
        );
      }
    }
  }

  // Also include directly installed skills (not via skill sets)
  const installed = await listInstalledMarketplaceSkills();
  for (const skill of installed) {
    if (seen.has(skill.source)) continue;
    seen.add(skill.source);
    const [ownerRepo, skillName] = skill.source.split("@");
    if (ownerRepo && skillName) {
      commands.push(
        `npx -y skills add ${ownerRepo} --skill ${skillName} --agent claude-code -y 2>/dev/null || true`,
      );
    }
  }

  return commands;
}
