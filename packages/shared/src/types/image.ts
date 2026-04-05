import type { RuntimeManifest } from "./runtime-manifest.js";

export const PRESET_IMAGES = {
  base: {
    tag: "optio-base:latest",
    label: "Base",
    description: "Git, Node.js, Python 3, gh CLI, Claude Code. Minimal footprint.",
    languages: [],
    provides: {
      languages: [
        { name: "node", version: "22" },
        { name: "python", version: "3" },
      ],
    } satisfies RuntimeManifest,
  },
  node: {
    tag: "optio-node:latest",
    label: "Node.js",
    description: "Base + pnpm, yarn, bun, native build tools.",
    languages: ["javascript", "typescript"],
    provides: {
      languages: [
        { name: "node", version: "22", tools: ["pnpm", "yarn", "bun"] },
        { name: "python", version: "3" },
      ],
      systemPackages: ["build-essential", "python3-dev"],
    } satisfies RuntimeManifest,
  },
  python: {
    tag: "optio-python:latest",
    label: "Python",
    description: "Base + pip, uv, poetry, venv support.",
    languages: ["python"],
    provides: {
      languages: [
        { name: "node", version: "22" },
        { name: "python", version: "3", tools: ["pip", "uv", "poetry", "venv"] },
      ],
      systemPackages: ["build-essential", "python3-dev"],
    } satisfies RuntimeManifest,
  },
  go: {
    tag: "optio-go:latest",
    label: "Go",
    description: "Base + Go 1.23, protoc, gopls.",
    languages: ["go"],
    provides: {
      languages: [
        { name: "node", version: "22" },
        { name: "python", version: "3" },
        { name: "go", version: "1.23", tools: ["protoc", "gopls"] },
      ],
    } satisfies RuntimeManifest,
  },
  rust: {
    tag: "optio-rust:latest",
    label: "Rust",
    description: "Base + rustup, cargo, cargo-nextest.",
    languages: ["rust"],
    provides: {
      languages: [
        { name: "node", version: "22" },
        { name: "python", version: "3" },
        { name: "rust", tools: ["cargo-watch", "cargo-nextest"] },
      ],
      systemPackages: ["build-essential", "pkg-config", "libssl-dev"],
    } satisfies RuntimeManifest,
  },
  full: {
    tag: "optio-full:latest",
    label: "Full",
    description: "Everything: Node.js, Python, Go, Rust, Docker, Postgres/Redis clients.",
    languages: ["javascript", "typescript", "python", "go", "rust"],
    provides: {
      languages: [
        { name: "node", version: "22", tools: ["pnpm", "yarn", "bun"] },
        { name: "python", version: "3", tools: ["pip", "uv", "poetry", "venv"] },
        { name: "go", version: "1.23", tools: ["protoc", "gopls"] },
        { name: "rust", tools: ["cargo-watch", "cargo-nextest"] },
      ],
      systemPackages: [
        "build-essential",
        "python3-dev",
        "pkg-config",
        "libssl-dev",
        "postgresql-client",
        "redis-tools",
      ],
      capabilities: ["docker"],
    } satisfies RuntimeManifest,
  },
  dind: {
    tag: "optio-dind:latest",
    label: "Docker-in-Docker",
    description:
      "Base + Docker daemon & CLI for repos that need docker build/run. Requires DinD enabled.",
    languages: [],
    provides: {
      languages: [
        { name: "node", version: "22" },
        { name: "python", version: "3" },
      ],
      capabilities: ["docker"],
    } satisfies RuntimeManifest,
  },
} as const;

export type PresetImageId = keyof typeof PRESET_IMAGES;

export interface RepoImageConfig {
  /** Use a preset image */
  preset?: PresetImageId;
  /** OR use a custom image tag */
  customImage?: string;
  /** OR build from a Dockerfile in the repo */
  dockerfilePath?: string;
  /** Extra apt packages to install at pod startup */
  extraPackages?: string[];
}
