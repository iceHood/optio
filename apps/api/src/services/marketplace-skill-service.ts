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

// ── Search skills.sh via GitHub API ─────────────────────────────────────────

export async function searchMarketplace(
  query: string,
  githubToken?: string,
): Promise<Array<{ source: string; name: string; description: string; stars: number }>> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Optio",
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

  // Search GitHub repos that have SKILL.md files
  const searchQuery = `${query} filename:SKILL.md`;
  const res = await fetch(
    `https://api.github.com/search/code?q=${encodeURIComponent(searchQuery)}&per_page=20`,
    { headers },
  );
  if (!res.ok) {
    throw new Error(`GitHub search failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    items: Array<{
      repository: { full_name: string; description: string; stargazers_count: number };
      path: string;
      name: string;
    }>;
  };

  // Deduplicate by repo
  const seen = new Set<string>();
  const results: Array<{ source: string; name: string; description: string; stars: number }> = [];
  for (const item of data.items) {
    const source = item.repository.full_name;
    if (seen.has(source)) continue;
    seen.add(source);

    // Derive skill name from path (e.g., skills/foo/SKILL.md → foo)
    const pathParts = item.path.split("/");
    const skillName =
      pathParts.length > 1
        ? pathParts[pathParts.length - 2]
        : (source.split("/")[1] ?? item.name.replace(/\.md$/, ""));

    results.push({
      source,
      name: skillName,
      description: item.repository.description ?? "",
      stars: item.repository.stargazers_count ?? 0,
    });
  }

  return results;
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
