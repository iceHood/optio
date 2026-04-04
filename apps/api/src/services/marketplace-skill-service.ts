import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { marketplaceSkills } from "../db/schema.js";
import { logger } from "../logger.js";
import type { MarketplaceSkillConfig } from "@optio/shared";

/**
 * Parse a SKILL.md file with optional YAML frontmatter.
 * Format:
 *   ---
 *   name: skill-name
 *   description: what it does
 *   ---
 *   [markdown body]
 */
function parseSkillMd(content: string): { name?: string; description?: string; body: string } {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) return { body: content.trim() };

  const frontmatter = fmMatch[1];
  const body = fmMatch[2].trim();

  let name: string | undefined;
  let description: string | undefined;
  for (const line of frontmatter.split("\n")) {
    const [key, ...rest] = line.split(":");
    const value = rest
      .join(":")
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key.trim() === "name") name = value;
    if (key.trim() === "description") description = value;
  }

  return { name, description, body };
}

// ── Fetch entire skills.sh catalog ──────────────────────────────────────────

interface SkillsCatalogEntry {
  source: string; // "owner/repo"
  skillId: string; // skill name within repo
  name: string;
  installs: number;
}

/**
 * Fetch the full skills.sh catalog by scraping the RSC data from the homepage.
 * The site embeds an `initialSkills` array in its server-rendered payload.
 */
export async function fetchSkillsCatalog(): Promise<SkillsCatalogEntry[]> {
  const res = await fetch("https://skills.sh/", {
    headers: { "User-Agent": "Optio" },
  });
  if (!res.ok) throw new Error(`Failed to fetch skills.sh: ${res.status}`);
  const html = await res.text();

  // Extract initialSkills JSON from RSC stream.
  // The data is embedded as escaped JSON inside a script tag:
  //   initialSkills\":[{\"source\":\"...\",\"skillId\":\"...\",\"name\":\"...\",\"installs\":123},...]
  // We need to find and unescape it.
  const escapedMatch = html.match(/initialSkills\\":\s*(\[.*?\])/);
  if (escapedMatch) {
    // Unescape the JSON: \" → "
    const unescaped = escapedMatch[1].replace(/\\"/g, '"');
    return JSON.parse(unescaped) as SkillsCatalogEntry[];
  }

  // Try unescaped variant (in case RSC format changes)
  const plainMatch = html.match(/"initialSkills":\s*(\[.*?\])/);
  if (plainMatch) {
    return JSON.parse(plainMatch[1]) as SkillsCatalogEntry[];
  }

  throw new Error("Could not find initialSkills in skills.sh response");
}

/**
 * Sync entire skills.sh catalog into marketplace_skills table.
 * Inserts new skills, updates existing ones (install counts).
 * Returns count of new + updated skills.
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
        prompt: "", // will be fetched on install
        installs: entry.installs,
        lastSyncedAt: new Date(),
        workspaceId: workspaceId ?? null,
      });
      added++;
    }
  }

  logger.info({ added, updated, total: catalog.length }, "Synced skills.sh catalog");
  return { added, updated, total: catalog.length };
}

/**
 * Search installed marketplace skills locally (in DB).
 * Filters by name, source, or description matching the query.
 */
export async function searchMarketplace(query: string): Promise<MarketplaceSkillConfig[]> {
  const all = await db.select().from(marketplaceSkills);
  const q = query.toLowerCase();
  const filtered = all.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.source.toLowerCase().includes(q) ||
      (s.description ?? "").toLowerCase().includes(q),
  );
  // Sort by installs descending (most popular first)
  filtered.sort((a, b) => (b.installs ?? 0) - (a.installs ?? 0));
  return filtered as MarketplaceSkillConfig[];
}

// ── Install a skill from GitHub ─────────────────────────────────────────────

export async function installFromGitHub(
  source: string,
  skillPath?: string,
  workspaceId?: string | null,
  githubToken?: string,
): Promise<MarketplaceSkillConfig> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Optio",
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

  // Get latest commit SHA
  const commitRes = await fetch(`https://api.github.com/repos/${source}/commits?per_page=1`, {
    headers,
  });
  if (!commitRes.ok) throw new Error(`Failed to fetch commits for ${source}: ${commitRes.status}`);
  const commits = (await commitRes.json()) as Array<{ sha: string }>;
  const sourceCommit = commits[0]?.sha ?? null;

  // Find SKILL.md if path not specified
  if (!skillPath) {
    const treeRes = await fetch(
      `https://api.github.com/repos/${source}/git/trees/HEAD?recursive=1`,
      { headers },
    );
    if (!treeRes.ok) throw new Error(`Failed to fetch tree for ${source}`);
    const tree = (await treeRes.json()) as {
      tree: Array<{ path: string; type: string }>;
    };
    const skillFile = tree.tree.find((f) => f.type === "blob" && f.path.endsWith("SKILL.md"));
    if (!skillFile) throw new Error(`No SKILL.md found in ${source}`);
    skillPath = skillFile.path;
  }

  // Download SKILL.md content
  const contentRes = await fetch(`https://api.github.com/repos/${source}/contents/${skillPath}`, {
    headers: { ...headers, Accept: "application/vnd.github.v3.raw" },
  });
  if (!contentRes.ok) throw new Error(`Failed to fetch ${skillPath} from ${source}`);
  const skillContent = await contentRes.text();

  const parsed = parseSkillMd(skillContent);
  const skillDir = skillPath.replace(/\/SKILL\.md$/, "");

  // Check for references/ directory
  const referenceFiles: Array<{ path: string; content: string }> = [];
  const refDir = `${skillDir}/references`;
  const refRes = await fetch(`https://api.github.com/repos/${source}/contents/${refDir}`, {
    headers,
  }).catch(() => null);
  if (refRes?.ok) {
    const refItems = (await refRes.json()) as Array<{
      name: string;
      path: string;
      type: string;
      download_url: string;
    }>;
    for (const item of refItems.filter((i) => i.type === "file")) {
      const content = await fetch(item.download_url).then((r) => r.text());
      referenceFiles.push({ path: `references/${item.name}`, content });
    }
  }

  // Derive skill name
  const name = parsed.name ?? skillDir.split("/").pop() ?? source.split("/")[1] ?? "unknown";

  // Upsert into DB
  const existing = await db
    .select()
    .from(marketplaceSkills)
    .where(and(eq(marketplaceSkills.source, source), eq(marketplaceSkills.skillPath, skillPath)));

  if (existing.length > 0) {
    const [updated] = await db
      .update(marketplaceSkills)
      .set({
        name,
        description: parsed.description ?? null,
        prompt: parsed.body,
        referenceFiles: referenceFiles.length > 0 ? referenceFiles : null,
        sourceCommit,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(marketplaceSkills.id, existing[0].id))
      .returning();
    logger.info({ source, name }, "Updated marketplace skill");
    return updated as MarketplaceSkillConfig;
  }

  const [created] = await db
    .insert(marketplaceSkills)
    .values({
      source,
      skillPath,
      name,
      description: parsed.description ?? null,
      prompt: parsed.body,
      referenceFiles: referenceFiles.length > 0 ? referenceFiles : null,
      sourceCommit,
      lastSyncedAt: new Date(),
      workspaceId: workspaceId ?? null,
    })
    .returning();

  logger.info({ source, name }, "Installed marketplace skill");
  return created as MarketplaceSkillConfig;
}

// ── List installed marketplace skills ───────────────────────────────────────

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

export async function getMarketplaceSkill(id: string): Promise<MarketplaceSkillConfig | null> {
  const [row] = await db.select().from(marketplaceSkills).where(eq(marketplaceSkills.id, id));
  return (row as MarketplaceSkillConfig) ?? null;
}

export async function deleteMarketplaceSkill(id: string): Promise<void> {
  await db.delete(marketplaceSkills).where(eq(marketplaceSkills.id, id));
}

// ── Sync all installed marketplace skills ───────────────────────────────────

export async function syncAllMarketplaceSkills(
  workspaceId?: string | null,
  githubToken?: string,
): Promise<{ synced: number; errors: string[] }> {
  const skills = await listMarketplaceSkills(workspaceId);
  let synced = 0;
  const errors: string[] = [];

  for (const skill of skills) {
    try {
      await installFromGitHub(skill.source, skill.skillPath, skill.workspaceId, githubToken);
      synced++;
    } catch (err) {
      errors.push(`${skill.source}: ${String(err)}`);
    }
  }

  return { synced, errors };
}
