-- Runtime manifest columns for manifest-based environment composition.
-- Repos own the execution environment (runtimeManifest).
-- Agents declare additive deps (runtimeRequires), not image ownership.
-- MCP servers and skills declare their own runtime dependencies (requires).

ALTER TABLE "repos" ADD COLUMN "runtime_manifest" jsonb;
ALTER TABLE "agents" ADD COLUMN "runtime_requires" jsonb;
ALTER TABLE "mcp_servers" ADD COLUMN "requires" jsonb;
ALTER TABLE "custom_skills" ADD COLUMN "requires" jsonb;

-- ── Data migration: convert existing imagePreset → runtimeManifest ──────────
-- Maps the old preset string to a structured RuntimeManifest with language requirements.
-- "base" has no languages (node/python are minimal, not dev-ready), so no manifest needed.

UPDATE "repos" SET "runtime_manifest" = '{"languages": [{"name": "node"}]}'::jsonb
  WHERE "image_preset" = 'node' AND "runtime_manifest" IS NULL;

UPDATE "repos" SET "runtime_manifest" = '{"languages": [{"name": "python"}]}'::jsonb
  WHERE "image_preset" = 'python' AND "runtime_manifest" IS NULL;

UPDATE "repos" SET "runtime_manifest" = '{"languages": [{"name": "go"}]}'::jsonb
  WHERE "image_preset" = 'go' AND "runtime_manifest" IS NULL;

UPDATE "repos" SET "runtime_manifest" = '{"languages": [{"name": "rust"}]}'::jsonb
  WHERE "image_preset" = 'rust' AND "runtime_manifest" IS NULL;

UPDATE "repos" SET "runtime_manifest" = '{"languages": [{"name": "node"}, {"name": "python"}, {"name": "go"}, {"name": "rust"}]}'::jsonb
  WHERE "image_preset" = 'full' AND "runtime_manifest" IS NULL;

UPDATE "repos" SET "runtime_manifest" = '{"capabilities": ["docker"]}'::jsonb
  WHERE "image_preset" = 'dind' AND "runtime_manifest" IS NULL;

-- Migrate repos with extra_packages into the manifest's systemPackages field.
-- Uses string_to_array to split comma-separated packages, then wraps in a JSON array.
UPDATE "repos" SET "runtime_manifest" = COALESCE("runtime_manifest", '{}'::jsonb) ||
  jsonb_build_object('systemPackages',
    (SELECT jsonb_agg(trim(pkg)) FROM unnest(string_to_array("extra_packages", ',')) AS pkg WHERE trim(pkg) != '')
  )
  WHERE "extra_packages" IS NOT NULL AND "extra_packages" != ''
    AND ("runtime_manifest" IS NULL OR NOT "runtime_manifest" ? 'systemPackages');

-- Migrate agents with extra_packages into runtimeRequires.systemPackages.
UPDATE "agents" SET "runtime_requires" = COALESCE("runtime_requires", '{}'::jsonb) ||
  jsonb_build_object('systemPackages',
    (SELECT jsonb_agg(trim(pkg)) FROM unnest(string_to_array("extra_packages", ',')) AS pkg WHERE trim(pkg) != '')
  )
  WHERE "extra_packages" IS NOT NULL AND "extra_packages" != ''
    AND ("runtime_requires" IS NULL OR NOT "runtime_requires" ? 'systemPackages');
