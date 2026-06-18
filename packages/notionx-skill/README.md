# @notionx/skill

One-command installer for the official **notionx** AI agent skill.
Supports Claude Code, Trae IDE, and **OpenAI Codex**.

`notionx` is a Next.js App Router framework on Cloudflare Workers with Notion
as the CMS. This package teaches any AI coding assistant how to work on a
notionx project — see [SKILL.md][skill] for the full description.

## Install the skill

```bash
# User-scope for the primary editors (Claude Code, Codex, Trae):
npx @notionx/skill install --target all --scope user

# Project-scope shared skill for agents that read .agents/skills:
npx @notionx/skill install --target shared --scope project
```

Run `npx @notionx/skill help` to see the help text, or
`npx @notionx/skill info` to see exactly where files would land for each
target.

## Commands

| Command | Description |
|---|---|
| `install` | Load the skill and write it to one or more targets |
| `uninstall` | Remove files written by `install` |
| `info` | Show the install plan without writing anything |
| `help` | Show usage |

## Flags

| Flag | Default | Notes |
|---|---|---|
| `--target` | `all` | `claude`, `codex`, `trae`, `trae-cn`, `shared`, `codex-rules`, or `all` (`claude,codex,trae`). Aliases: `claude-code` -> `claude`, `agents`/`universal` -> `shared`. |
| `--scope` | `user` | `user` (editor global skills dir) or `project` (current repo) |
| `--source` | `npm` | `npm` (bundled in this package), `local` (monorepo), `github` (raw from `digwis/notionx`) |
| `--ref` | `main` | Git ref for `--source=github` |
| `--cwd` | `$PWD` | Project root for `--scope=project` |
| `--force` | `false` | Overwrite existing skill files (`codex-rules`: overwrite `AGENTS.md`) |
| `--dry-run` | `false` | Print what would be written; don't touch disk |
| `--json` | `false` | Machine-readable output |

## Where files go

| Target | User-scope | Project-scope |
|---|---|---|
| `claude` | `~/.claude/skills/notionx/` | `./.claude/skills/notionx/` |
| `codex` | `${CODEX_HOME:-~/.codex}/skills/notionx/` | `./.agents/skills/notionx/` |
| `trae` | `~/.trae/skills/notionx/` | `./.trae/skills/notionx/` |
| `trae-cn` | `~/.trae-cn/skills/notionx/` | `./.trae/skills/notionx/` |
| `shared` | `~/.agents/skills/notionx/` | `./.agents/skills/notionx/` |
| `codex-rules` | `${CODEX_HOME:-~/.codex}/AGENTS.md` | `./AGENTS.md` |

`codex` installs a real Codex skill directory with `SKILL.md`, references, and
OpenAI metadata. `codex-rules` is a separate rule-only target for users who also
want a `## notionx` section appended to `AGENTS.md`.

## Examples

```bash
# Try the latest unreleased skill from main:
npx @notionx/skill install --target claude --source github --ref main

# Dry-run: see what would be written for the primary editors, project-scope:
npx @notionx/skill install --target all --scope project --dry-run

# Install only Codex globally:
npx @notionx/skill install --target codex --scope user

# Add project-level Codex rules to AGENTS.md:
npx @notionx/skill install --target codex-rules --scope project

# Uninstall the Codex skill directory:
npx @notionx/skill uninstall --target codex

# Machine-readable install for CI:
npx @notionx/skill install --target all --scope project --json
```

## How it works

The skill content lives at the top of the notionx monorepo:
[`skills/notionx/`][skill-folder]. When this npm package is published, a
prepublish script copies that folder into `skill/` so it's bundled with
the tarball. At runtime the CLI:

1. Resolves the skill from one of `--source=local|github|npm`.
2. Builds an in-memory `SkillBundle` (SKILL.md + references + metadata + target rules).
3. For each target, runs a small installer that writes the right files
   into the right place.

The CLI has **no third-party runtime dependencies** — only Node ≥ 22.

## Development

```bash
pnpm install
pnpm test          # vitest
pnpm build         # tsup → dist/cli.js
pnpm dev install --target codex --scope project --source local
```

The `pretest` and `prebuild` scripts run `scripts/sync-bundled-skill.mjs`,
which copies `../../skills/notionx/` into this package's `skill/` folder.
That keeps the bundled content in sync with the source of truth.

## License

MIT © zhaofilms — same as the rest of the notionx monorepo.

[skill]: https://github.com/digwis/notionx/blob/main/skills/notionx/SKILL.md
[skill-folder]: https://github.com/digwis/notionx/tree/main/skills/notionx
