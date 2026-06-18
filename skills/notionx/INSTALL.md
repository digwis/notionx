# Installing the notionx skill manually

The official notionx skill is shipped from the
[notionx repository](https://github.com/digwis/notionx) under `skills/notionx/`.
The recommended install is via the `@notionx/skill` CLI package (see below), but every
target also supports a **manual install** that you can do without any extra
tooling.

## TL;DR — the CLI

```bash
# User-scope (installs the primary editors)
npx @notionx/skill install --target all

# Project-scope shared skill
npx @notionx/skill install --target shared --scope project
```

Supported `--target` values: `claude`, `codex`, `trae`, `trae-cn`, `shared`, `codex-rules`, `all`.
Aliases: `claude-code` -> `claude`, `agents`/`universal` -> `shared`.

## What gets installed

| Target | User-scope path | Project-scope path |
|---|---|---|
| `claude` (Claude Code) | `~/.claude/skills/notionx/` | `./.claude/skills/notionx/` |
| `codex` (OpenAI Codex) | `${CODEX_HOME:-~/.codex}/skills/notionx/` | `./.agents/skills/notionx/` |
| `trae` (Trae IDE) | `~/.trae/skills/notionx/` | `./.trae/skills/notionx/` |
| `trae-cn` (Trae CN) | `~/.trae-cn/skills/notionx/` | `./.trae/skills/notionx/` |
| `shared` (generic `.agents` skill) | `~/.agents/skills/notionx/` | `./.agents/skills/notionx/` |
| `codex-rules` (project rules) | `${CODEX_HOME:-~/.codex}/AGENTS.md` | `./AGENTS.md` |

The project-scope paths are designed to be **committed to the repo** so every
contributor picks up the skill or rule automatically.

`codex` installs a real Codex skill directory. Use `codex-rules` only if you
also want the optional `AGENTS.md` convention block.

## Manual install — Claude Code

```bash
mkdir -p ~/.claude/skills/notionx
curl -L https://raw.githubusercontent.com/digwis/notionx/main/skills/notionx/SKILL.md \
  -o ~/.claude/skills/notionx/SKILL.md
```

Optionally also pull the references:

```bash
cd ~/.claude/skills/notionx
mkdir -p references
for f in architecture content-source domain-module deploy troubleshooting four-contracts; do
  curl -L "https://raw.githubusercontent.com/digwis/notionx/main/skills/notionx/references/${f}.md" \
    -o "references/${f}.md"
done
```

## Manual install — Trae IDE

```bash
mkdir -p ~/.trae/skills/notionx
curl -L https://raw.githubusercontent.com/digwis/notionx/main/skills/notionx/SKILL.md \
  -o ~/.trae/skills/notionx/SKILL.md
```

(Same shape as Claude Code — Trae reads the same SKILL.md format.)

## Manual install — OpenAI Codex

Codex reads skill directories from `${CODEX_HOME:-~/.codex}/skills/notionx/`.

```bash
# User-scope (applies to every project on this machine):
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills/notionx"
curl -L https://raw.githubusercontent.com/digwis/notionx/main/skills/notionx/SKILL.md \
  -o "${CODEX_HOME:-$HOME/.codex}/skills/notionx/SKILL.md"

# Project-scope (commit the shared skill directory to the repo):
mkdir -p .agents/skills/notionx
curl -L https://raw.githubusercontent.com/digwis/notionx/main/skills/notionx/SKILL.md \
  -o .agents/skills/notionx/SKILL.md
```

To also add the optional AGENTS.md conventions block:

```bash
curl -L https://raw.githubusercontent.com/digwis/notionx/main/skills/notionx/rules/codex.md \
  -o "${CODEX_HOME:-$HOME/.codex}/AGENTS.md"
curl -L https://raw.githubusercontent.com/digwis/notionx/main/skills/notionx/rules/codex.md \
  -o AGENTS.md
```

If `AGENTS.md` already exists and you want to keep its content, append the rule
to it instead of overwriting:

```bash
printf "\n\n## notionx\n\n" >> AGENTS.md
curl -L https://raw.githubusercontent.com/digwis/notionx/main/skills/notionx/rules/codex.md \
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
| Claude Code | `rm -rf ~/.claude/skills/notionx` |
| Codex | `rm -rf "${CODEX_HOME:-$HOME/.codex}/skills/notionx"` |
| Trae | `rm -rf ~/.trae/skills/notionx` |
| Trae CN | `rm -rf ~/.trae-cn/skills/notionx` |
| Shared | `rm -rf ~/.agents/skills/notionx` |
| AGENTS.md rules | Edit `~/.codex/AGENTS.md` (or `./AGENTS.md`) and remove the `## notionx` section |

## Verifying the install

After installing, restart your editor and open a notionx project. The AI
assistant should now recognise terms like `@notionx/core`,
`defineContentSource`, `createNotionxWorker`, and `notionx:doctor`
automatically, and follow the conventions in `SKILL.md`.

If it doesn't, the most common causes are:

1. Editor not restarted.
2. The skill / rule file is in the wrong directory (see the table above).
3. For project-scope installs: the file was gitignored.

## Cross-platform reference

The skill is the **same content** across all supported targets — only the file
location and frontmatter format differ. The CLI handles the conversion;
manual install just drops the right file in the right place.
