/**
 * Shared types for notionx-skill.
 */

/** Platforms we can install the skill into. */
export type Target =
  | "claude"
  | "codex"
  | "trae"
  | "trae-cn"
  | "shared"
  | "codex-rules";

/** Install scope: `user` = editor's global config dir; `project` = current working dir. */
export type Scope = "user" | "project";

/** Where the skill content is read from. */
export type Source = "local" | "github" | "npm";

/** Canonical target ids accepted by the CLI. */
export const ALL_TARGETS: readonly Target[] = [
  "claude",
  "codex",
  "trae",
  "trae-cn",
  "shared",
  "codex-rules",
] as const;

/** The targets installed by `--target all`; rule-only targets stay explicit. */
export const DEFAULT_TARGETS: readonly Target[] = [
  "claude",
  "codex",
  "trae",
] as const;

export function isTarget(value: string): value is Target {
  return (ALL_TARGETS as readonly string[]).includes(value);
}

/** A loaded skill: SKILL.md, references, rules, and the install guide. */
export interface SkillBundle {
  /** Content of SKILL.md (Claude Code / Trae). */
  skill: string;
  /** Map of reference filename (without .md) -> content. */
  references: Record<string, string>;
  /** Map of rule target id -> rule file content. */
  rules: Partial<Record<Target, string>>;
  /** Optional OpenAI/Codex UI metadata from agents/openai.yaml. */
  openaiYaml?: string;
  /** Content of INSTALL.md. */
  installGuide: string;
  /** Version of the skill (e.g. the npm package version, or git sha). */
  version: string;
}

/** Options that control a single install invocation. */
export interface InstallOptions {
  target: Target | "all";
  scope: Scope;
  source: Source;
  /** Working directory for `scope: "project"`. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Overwrite existing files. Default: false. */
  force?: boolean;
  /** Don't actually write; return what would be written. Default: false. */
  dryRun?: boolean;
  /** GitHub ref (branch / tag / sha). Only used when `source: "github"`. */
  githubRef?: string;
}

/** Result of writing one file. */
export interface FileWrite {
  path: string;
  bytes: number;
}

/** Result of skipping one file. */
export interface FileSkip {
  path: string;
  reason: string;
}

/** Result for a single (target, scope) pair. */
export interface InstallResult {
  target: Target;
  scope: Scope;
  filesWritten: FileWrite[];
  filesSkipped: FileSkip[];
}
