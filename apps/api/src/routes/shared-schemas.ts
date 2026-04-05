import { z } from "zod";

/** Zod schema for RuntimeManifest — shared across agent, repo, MCP, and skill routes. */
export const runtimeManifestSchema = z.object({
  languages: z
    .array(
      z.object({
        name: z.enum(["node", "python", "go", "rust"]),
        version: z.string().optional(),
        tools: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  systemPackages: z.array(z.string()).optional(),
  nodePackages: z.array(z.string()).optional(),
  pythonPackages: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  setup: z.array(z.string()).optional(),
  capabilities: z.array(z.enum(["docker", "gpu", "browser"])).optional(),
});
