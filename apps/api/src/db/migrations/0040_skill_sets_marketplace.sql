-- Marketplace skills (from skills.sh ecosystem)
CREATE TABLE IF NOT EXISTS "marketplace_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source" text NOT NULL,
  "skill_path" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "prompt" text NOT NULL DEFAULT '',
  "reference_files" jsonb,
  "installs" integer DEFAULT 0,
  "installed" boolean NOT NULL DEFAULT false,
  "source_commit" text,
  "last_synced_at" timestamp with time zone,
  "workspace_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_skills_source_idx" ON "marketplace_skills" USING btree ("source");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_skills_workspace_id_idx" ON "marketplace_skills" USING btree ("workspace_id");
--> statement-breakpoint

-- Skill sets (groups of skills assignable to repos)
CREATE TABLE IF NOT EXISTS "skill_sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "scope" text DEFAULT 'global' NOT NULL,
  "workspace_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skill_sets_scope_idx" ON "skill_sets" USING btree ("scope");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skill_sets_workspace_id_idx" ON "skill_sets" USING btree ("workspace_id");
--> statement-breakpoint

-- Skill set items (skills within a set)
CREATE TABLE IF NOT EXISTS "skill_set_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "skill_set_id" uuid NOT NULL REFERENCES "skill_sets"("id") ON DELETE CASCADE,
  "skill_type" text NOT NULL,
  "skill_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skill_set_items_set_id_idx" ON "skill_set_items" USING btree ("skill_set_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skill_set_items_skill_idx" ON "skill_set_items" USING btree ("skill_type", "skill_id");
--> statement-breakpoint

-- Repo-to-skill-set assignments
CREATE TABLE IF NOT EXISTS "repo_skill_sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "repo_url" text NOT NULL,
  "skill_set_id" uuid NOT NULL REFERENCES "skill_sets"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repo_skill_sets_repo_url_idx" ON "repo_skill_sets" USING btree ("repo_url");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repo_skill_sets_set_id_idx" ON "repo_skill_sets" USING btree ("skill_set_id");
--> statement-breakpoint

-- Add files column to custom_skills for zip/skill archive contents
ALTER TABLE "custom_skills" ADD COLUMN IF NOT EXISTS "files" jsonb;
