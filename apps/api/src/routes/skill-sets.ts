import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as skillSetService from "../services/skill-set-service.js";
import * as marketplaceService from "../services/marketplace-skill-service.js";

export async function skillSetRoutes(app: FastifyInstance) {
  // ── Skill Sets CRUD ─────────────────────────────────────────────────────

  app.get("/api/skill-sets", async (req, reply) => {
    const wsId = req.user?.workspaceId || null;
    const sets = await skillSetService.listSkillSets(wsId);
    reply.send({ skillSets: sets });
  });

  app.get("/api/skill-sets/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const set = await skillSetService.getSkillSet(id);
    if (!set) return reply.status(404).send({ error: "Skill set not found" });
    reply.send({ skillSet: set });
  });

  const createSkillSetSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    scope: z.string().optional(),
  });

  app.post("/api/skill-sets", async (req, reply) => {
    const parsed = createSkillSetSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const wsId = req.user?.workspaceId || null;
    const set = await skillSetService.createSkillSet({ ...parsed.data, workspaceId: wsId });
    reply.status(201).send({ skillSet: set });
  });

  const updateSkillSetSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
  });

  app.patch("/api/skill-sets/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateSkillSetSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const set = await skillSetService.updateSkillSet(id, parsed.data);
    if (!set) return reply.status(404).send({ error: "Skill set not found" });
    reply.send({ skillSet: set });
  });

  app.delete("/api/skill-sets/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await skillSetService.deleteSkillSet(id);
    reply.status(204).send();
  });

  // ── Skill Set Items ───────────────────────────────────────────────────────

  const addItemSchema = z.object({
    skillType: z.enum(["custom", "marketplace"]),
    skillId: z.string().uuid(),
  });

  app.post("/api/skill-sets/:id/items", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = addItemSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const item = await skillSetService.addSkillSetItem(
      id,
      parsed.data.skillType,
      parsed.data.skillId,
    );
    reply.status(201).send({ item });
  });

  app.delete("/api/skill-sets/:id/items/:itemId", async (req, reply) => {
    const { itemId } = req.params as { id: string; itemId: string };
    await skillSetService.removeSkillSetItem(itemId);
    reply.status(204).send();
  });

  // ── Repo ↔ Skill Set Assignments ──────────────────────────────────────────

  app.get("/api/repos/:repoUrl/skill-sets", async (req, reply) => {
    const { repoUrl } = req.params as { repoUrl: string };
    const decodedUrl = decodeURIComponent(repoUrl);
    const sets = await skillSetService.getRepoSkillSets(decodedUrl);
    reply.send({ skillSets: sets });
  });

  const assignSchema = z.object({ skillSetId: z.string().uuid() });

  app.post("/api/repos/:repoUrl/skill-sets", async (req, reply) => {
    const { repoUrl } = req.params as { repoUrl: string };
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const decodedUrl = decodeURIComponent(repoUrl);
    await skillSetService.assignSkillSetToRepo(decodedUrl, parsed.data.skillSetId);
    reply.status(201).send({ ok: true });
  });

  app.delete("/api/repos/:repoUrl/skill-sets/:setId", async (req, reply) => {
    const { repoUrl, setId } = req.params as { repoUrl: string; setId: string };
    const decodedUrl = decodeURIComponent(repoUrl);
    await skillSetService.removeSkillSetFromRepo(decodedUrl, setId);
    reply.status(204).send();
  });

  // ── Marketplace Skills ────────────────────────────────────────────────────

  // Search local DB (skills must be synced first)
  const searchSchema = z.object({ query: z.string().max(200).default("") });

  app.post("/api/skills/marketplace/search", async (req, reply) => {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const results = await marketplaceService.searchMarketplace(parsed.data.query);
    reply.send({ skills: results });
  });

  // List all marketplace skills in DB
  app.get("/api/skills/marketplace", async (req, reply) => {
    const wsId = req.user?.workspaceId || null;
    const skills = await marketplaceService.listMarketplaceSkills(wsId);
    reply.send({ skills });
  });

  // Install: just mark as installed (actual install via npx skills add in container)
  app.post("/api/skills/marketplace/:id/install", async (req, reply) => {
    const { id } = req.params as { id: string };
    const skill = await marketplaceService.installSkill(id);
    reply.send({ skill });
  });

  // Uninstall
  app.post("/api/skills/marketplace/:id/uninstall", async (req, reply) => {
    const { id } = req.params as { id: string };
    await marketplaceService.uninstallSkill(id);
    reply.status(204).send();
  });

  app.delete("/api/skills/marketplace/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await marketplaceService.deleteMarketplaceSkill(id);
    reply.status(204).send();
  });

  // Sync: fetch entire skills.sh catalog → update/insert into DB
  app.post("/api/skills/marketplace/sync", async (req, reply) => {
    const wsId = req.user?.workspaceId || null;
    try {
      const result = await marketplaceService.syncCatalog(wsId);
      reply.send(result);
    } catch (err) {
      reply.status(500).send({ error: `Sync failed: ${String(err)}` });
    }
  });

  // ── Skill Upload (SKILL.md content as JSON) ────────────────────────────

  const uploadSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    content: z.string().min(1), // SKILL.md content (markdown)
    referenceFiles: z.array(z.object({ path: z.string(), content: z.string() })).optional(),
  });

  app.post("/api/skills/upload", async (req, reply) => {
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });

    const { createSkill } = await import("../services/skill-service.js");
    const wsId = req.user?.workspaceId || null;
    const skill = await createSkill(
      {
        name: parsed.data.name,
        description: parsed.data.description,
        prompt: parsed.data.content,
      },
      wsId,
    );

    reply.status(201).send({ skill });
  });
}
