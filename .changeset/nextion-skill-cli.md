---
"@notionx/skill": minor
---

Add `@notionx/skill`: one-command installer for the official nextion AI
agent skill. Installs the skill content shipped at `skills/nextion/` into
Claude Code, OpenAI Codex, and Trae IDE.

Usage:
  npx @notionx/skill install --target all --scope project

Supports `--source=local|github|npm`, `--dry-run`, `--force`, `--json`.
See `packages/nextion-skill/README.md` for full docs.
