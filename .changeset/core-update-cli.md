---
"@notionx/cli": minor
---

Make `notionx update --core` update project metadata instead of only reporting
doctor state.

The command now updates `package.json` and `.notionx/registry.json`, supports
`--dry-run`, `--target latest|next`, and `--to <version-or-range>`, and prints
the install/test follow-up steps needed before deployment.
