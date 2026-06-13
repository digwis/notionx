# Installing the nextion skill manually

The official nextion skill is shipped from the
[nextion repository](https://github.com/digwis/nextion) under `skills/nextion/`.
The recommended install is via the `@notionx/skill` CLI package (see below), but every
target also supports a **manual install** that you can do without any extra
tooling.

## TL;DR — the CLI

```bash
# User-scope (applies to every project you open in this editor)
npx @notionx/skill install --target <editor>

# Project-scope (committed to the repo so the whole team gets it)
npx @notionx/skill install --target <editor> --scope project
```

Supported `--target` values: `claude`, `trae`, `codex`, `all`.

## What gets installed

| Target | User-scope path | Project-scope path |
|---|---|---|
| `claude` (Claude Code) | `~/.claude/skills/nextion/` | `./.claude/skills/nextion/` |
| `trae` (Trae IDE) | `~/.trae/skills/nextion/` | `./.trae/skills/nextion/` |
| `codex` (OpenAI Codex) | `~/.codex/AGENTS.md` | `./AGENTS.md` |

The project-scope paths are designed to be **committed to the repo** so every
contributor picks up the rule automatically.

> **Codex note:** `AGENTS.md` is a shared file. If `./AGENTS.md` already
> exists, the installer **appends** a `## nextion` section instead of
> overwriting, so you can keep your other project conventions. Pass
> `--force` to overwrite.

## Manual install — Claude Code

```bash
mkdir -p ~/.claude/skills/nextion
curl -L https://raw.githubusercontent.com/digwis/nextion/main/skills/nextion/SKILL.md \
  -o ~/.claude/skills/nextion/SKILL.md
```

Optionally also pull the references:

```bash
cd ~/.claude/skills/nextion
mkdir -p references
for f in architecture content-source domain-module deploy troubleshooting four-contracts; do
  curl -L "https://raw.githubusercontent.com/digwis/nextion/main/skills/nextion/references/${f}.md" \
    -o "references/${f}.md"
done
```

## Manual install — Trae IDE

```bash
mkdir -p ~/.trae/skills/nextion
curl -L https://raw.githubusercontent.com/digwis/nextion/main/skills/nextion/SKILL.md \
  -o ~/.trae/skills/nextion/SKILL.md
```

(Same shape as Claude Code — Trae reads the same SKILL.md format.)

## Manual install — OpenAI Codex

Codex reads `AGENTS.md` files. User-scope lives at `~/.codex/AGENTS.md`;
project-scope at the repo root as `./AGENTS.md`.

```bash
# User-scope (applies to every project on this machine):
mkdir -p ~/.codex
curl -L https://raw.githubusercontent.com/digwis/nextion/main/skills/nextion/rules/codex.md \
  -o ~/.codex/AGENTS.md

# Project-scope (commit the file to the repo):
curl -L https://raw.githubusercontent.com/digwis/nextion/main/skills/nextion/rules/codex.md \
  -o AGENTS.md
```

If `AGENTS.md` already exists and you want to keep its content, append
the rule to it instead of overwriting:

```bash
printf "\n\n## nextion\n\n" >> AGENTS.md
curl -L https://raw.githubusercontent.com/digwis/nextion/main/skills/nextion/rules/codex.md \
  >> AGENTS.md
```

The official CLI does this append-or-create logic for you automatically.

## Updating

```bash
npx @notionx/skill install --target <editor> --force
```

or, manually, just re-run the curl commands — the files are deterministic
and overwrite is safe.

## Uninstalling

| Target | Command |
|---|---|
| Claude Code | `rm -rf ~/.claude/skills/nextion` |
| Trae | `rm -rf ~/.trae/skills/nextion` |
| Codex | Edit `~/.codex/AGENTS.md` (or `./AGENTS.md`) and remove the `## nextion` section |

## Verifying the install

After installing, restart your editor and open a nextion project. The AI
assistant should now recognise terms like `@notionx/core`,
`defineContentSource`, `createNextionWorker`, and `nextion:doctor`
automatically, and follow the conventions in `SKILL.md`.

If it doesn't, the most common causes are:

1. Editor not restarted.
2. The skill / rule file is in the wrong directory (see the table above).
3. For project-scope installs: the file was gitignored.

## Cross-platform reference

The skill is the **same content** across all supported targets — only the file
location and frontmatter format differ. The CLI handles the conversion;
manual install just drops the right file in the right place.
