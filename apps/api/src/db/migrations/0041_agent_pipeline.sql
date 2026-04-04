-- Agents: reusable agent configuration bundles
CREATE TABLE IF NOT EXISTS "agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "agent_type" text DEFAULT 'claude-code' NOT NULL,
  "model" text,
  "context_window" text,
  "thinking" boolean,
  "effort" text,
  "image_preset" text,
  "custom_dockerfile" text,
  "extra_packages" text,
  "setup_commands" text,
  "max_turns" integer,
  "prompt_template" text,
  "workspace_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_workspace_id_idx" ON "agents" USING btree ("workspace_id");
--> statement-breakpoint

-- Agent ↔ MCP Server associations
CREATE TABLE IF NOT EXISTS "agent_mcp_servers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "mcp_server_id" uuid NOT NULL REFERENCES "mcp_servers"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_mcp_servers_agent_id_idx" ON "agent_mcp_servers" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_mcp_servers_mcp_server_id_idx" ON "agent_mcp_servers" USING btree ("mcp_server_id");
--> statement-breakpoint

-- Agent ↔ Skill Set associations
CREATE TABLE IF NOT EXISTS "agent_skill_sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "skill_set_id" uuid NOT NULL REFERENCES "skill_sets"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_skill_sets_agent_id_idx" ON "agent_skill_sets" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_skill_sets_skill_set_id_idx" ON "agent_skill_sets" USING btree ("skill_set_id");
--> statement-breakpoint

-- Repo pipeline stages: assign agents to stages per repo
CREATE TABLE IF NOT EXISTS "repo_pipeline_stages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "repo_id" uuid NOT NULL REFERENCES "repos"("id") ON DELETE CASCADE,
  "stage" text NOT NULL,
  "stage_order" integer NOT NULL,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repo_pipeline_stages_repo_id_idx" ON "repo_pipeline_stages" USING btree ("repo_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repo_pipeline_stages_agent_id_idx" ON "repo_pipeline_stages" USING btree ("agent_id");
--> statement-breakpoint

-- Add agent tracking columns to tasks
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "agent_id" uuid;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "pipeline_stage_id" uuid;
