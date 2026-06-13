---
"@notionx/skill": minor
---

Add `codex` (OpenAI Codex CLI / IDE) as a supported target. The installer
now understands `AGENTS.md`:

- User-scope: writes `~/.codex/AGENTS.md`
- Project-scope: writes `./AGENTS.md` (append-aware: if the file exists
  and has no `## nextion` section yet, the rule is appended with a
  `## nextion` header; if the section is already present, install is a
  no-op; pass `--force` to overwrite)
- Uninstall is manual: the CLI prints the file and section to remove,
  since `AGENTS.md` may hold other project conventions

Supported targets are now: `claude`, `trae`, `codex`, `cursor`, `windsurf`,
`copilot`, `all`.

```bash
npx nextion-skill install --target codex --scope project
```
