# Release Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make GitHub `main` the source of truth for npm releases by fixing Changesets naming/tooling and reordering the release workflow to push before publish.

**Architecture:** Keep the existing monorepo and Changesets workflow, but remove the publish-first failure mode. The implementation first makes package identity/tooling deterministic, then updates `.github/workflows/release.yml` to version, commit, and push before `pnpm publish`, and finally verifies the new behavior with targeted CLI checks.

**Tech Stack:** GitHub Actions, pnpm, Changesets, YAML, JSON

---

### Task 1: Normalize Changesets Package Identity And Tooling

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.changeset/blog-scaffold-release.md`
- Modify: `.changeset/publish-create-nextion-app.md`
- Modify: `.changeset/initial-foundation.md`
- Modify: `.changeset/codex-target.md`
- Modify: `.changeset/config.json`

- [ ] **Step 1: Add the failing verification commands to your shell session**

Run:

```bash
node -e 'const fs=require("fs"); const files=[".changeset/blog-scaffold-release.md",".changeset/publish-create-nextion-app.md",".changeset/initial-foundation.md",".changeset/codex-target.md"]; for (const file of files) { const text=fs.readFileSync(file,"utf8"); console.log(file + " => " + text.split("\n")[1]); }'
pnpm changeset --version
```

Expected:

```text
.changeset/blog-scaffold-release.md => "create-nextion-app": minor
.changeset/publish-create-nextion-app.md => "create-nextion-app": minor
.changeset/initial-foundation.md => "@nextion/core": major
.changeset/codex-target.md => "nextion-skill": minor
ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "changeset" not found
```

- [ ] **Step 2: Update the root workspace tooling and Changesets config**

Apply this exact edit to `package.json` and `.changeset/config.json`:

```json
{
  "devDependencies": {
    "@changesets/cli": "^2.29.0",
    "@eslint/js": "^9",
    "eslint-import-resolver-typescript": "^4",
    "eslint-plugin-import": "^2",
    "globals": "^15",
    "husky": "^9",
    "typescript": "^5",
    "typescript-eslint": "^8"
  }
}
```

```json
{
  "$schema": "https://unpkg.com/@changesets/config@2/schema.json",
  "changelog": ["@changesets/cli/changelog", null],
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "privatePackages": {
    "tag": false,
    "version": false
  }
}
```

- [ ] **Step 3: Rename the stale package identifiers in the pending changesets**

Apply these exact frontmatter replacements:

```md
--- 
"@notionx/create-nextion-app": minor
---
```

Use that frontmatter in:

```text
.changeset/blog-scaffold-release.md
.changeset/publish-create-nextion-app.md
```

Apply this exact frontmatter to `.changeset/initial-foundation.md`:

```md
---
"@notionx/core": major
---
```

Apply this exact frontmatter to `.changeset/codex-target.md`:

```md
---
"@notionx/skill": minor
---
```

- [ ] **Step 4: Refresh the lockfile**

Run:

```bash
pnpm install
```

Expected:

```text
Lockfile is updated and `@changesets/cli` is added to the workspace dependencies.
```

- [ ] **Step 5: Run the verification commands again**

Run:

```bash
node -e 'const fs=require("fs"); const files=[".changeset/blog-scaffold-release.md",".changeset/publish-create-nextion-app.md",".changeset/initial-foundation.md",".changeset/codex-target.md"]; for (const file of files) { const text=fs.readFileSync(file,"utf8"); console.log(file + " => " + text.split("\n")[1]); }'
pnpm changeset --version
```

Expected:

```text
.changeset/blog-scaffold-release.md => "@notionx/create-nextion-app": minor
.changeset/publish-create-nextion-app.md => "@notionx/create-nextion-app": minor
.changeset/initial-foundation.md => "@notionx/core": major
.changeset/codex-target.md => "@notionx/skill": minor
2.x.x
```

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json pnpm-lock.yaml .changeset/config.json .changeset/blog-scaffold-release.md .changeset/publish-create-nextion-app.md .changeset/initial-foundation.md .changeset/codex-target.md
git commit -m "fix: normalize changesets package metadata"
```

### Task 2: Reorder The Release Workflow To Push Before Publish

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Capture the current risky ordering**

Run:

```bash
sed -n '1,120p' .github/workflows/release.yml
```

Expected to still show:

```yaml
- name: Version + publish packages (changesets)
  uses: changesets/action@v1
...
- name: Push version commit back to main
  run: |
    git push origin HEAD:main
```

- [ ] **Step 2: Replace the workflow trigger coverage and publish ordering**

Update `.github/workflows/release.yml` so the `paths` section and the release steps match this structure:

```yaml
on:
  push:
    branches: [main]
    paths:
      - "packages/nextion/**"
      - "packages/create-nextion-app/**"
      - "packages/nextion-skill/**"
      - ".changeset/**"
      - ".github/workflows/release.yml"
```

```yaml
      - name: Build nextion
        run: pnpm --filter @notionx/core build
      - name: Build create-nextion-app
        run: pnpm --filter @notionx/create-nextion-app build
      - name: Build nextion-skill
        run: pnpm --filter @notionx/skill build

      - name: Version packages
        run: pnpm changeset version

      - name: Commit version changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .
          git diff --cached --quiet && exit 0
          git commit -m "chore(release): version packages"

      - name: Push version commit back to main
        run: git push origin HEAD:main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Publish packages
        run: pnpm -r publish --no-git-checks --tag latest
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 3: Preserve the failure boundary**

Ensure the workflow no longer contains `changesets/action@v1`, and publish now happens only after the explicit push step. The final release section should read like:

```yaml
      - name: Version packages
        run: pnpm changeset version
      - name: Commit version changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .
          git diff --cached --quiet && exit 0
          git commit -m "chore(release): version packages"
      - name: Push version commit back to main
        run: git push origin HEAD:main
      - name: Publish packages
        run: pnpm -r publish --no-git-checks --tag latest
```

- [ ] **Step 4: Verify the workflow text**

Run:

```bash
grep -n 'packages/nextion-skill/\*\*' .github/workflows/release.yml
grep -n 'changesets/action@v1' .github/workflows/release.yml || true
grep -n 'name: Publish packages' .github/workflows/release.yml
grep -n 'name: Push version commit back to main' .github/workflows/release.yml
```

Expected:

```text
`packages/nextion-skill/**` is present
no match for `changesets/action@v1`
both `Push version commit back to main` and `Publish packages` exist
```

- [ ] **Step 5: Commit**

Run:

```bash
git add .github/workflows/release.yml
git commit -m "fix: publish only after pushing release commit"
```

### Task 3: Validate The Release Flow End-To-End

**Files:**
- Verify: `.github/workflows/release.yml`
- Verify: `package.json`
- Verify: `.changeset/config.json`
- Verify: `.changeset/blog-scaffold-release.md`
- Verify: `.changeset/publish-create-nextion-app.md`
- Verify: `.changeset/initial-foundation.md`
- Verify: `.changeset/codex-target.md`

- [ ] **Step 1: Run targeted tooling checks**

Run:

```bash
pnpm changeset status --help
node -e 'const fs=require("fs"); const yaml=fs.readFileSync(".github/workflows/release.yml","utf8"); const pushIndex=yaml.indexOf("name: Push version commit back to main"); const publishIndex=yaml.indexOf("name: Publish packages"); console.log({pushIndex, publishIndex, publishAfterPush: publishIndex > pushIndex});'
```

Expected:

```text
Changesets help output is printed
{ pushIndex: <number>, publishIndex: <number>, publishAfterPush: true }
```

- [ ] **Step 2: Run diagnostics on the touched files**

Use the editor diagnostics tool on:

```text
/Users/zhao/项目/nextion/.github/workflows/release.yml
/Users/zhao/项目/nextion/package.json
/Users/zhao/项目/nextion/.changeset/config.json
```

Expected:

```text
No new syntax or schema errors in the edited config files.
```

- [ ] **Step 3: Review the final diff for scope**

Run:

```bash
git diff --stat HEAD~2..HEAD
git diff -- .github/workflows/release.yml package.json pnpm-lock.yaml .changeset/config.json .changeset/blog-scaffold-release.md .changeset/publish-create-nextion-app.md .changeset/initial-foundation.md .changeset/codex-target.md
```

Expected:

```text
Only the release workflow, root tooling, lockfile, and targeted changeset metadata changed.
```

- [ ] **Step 4: Commit**

Run:

```bash
git status --short
git commit --allow-empty -m "chore: validate release consistency changes"
```

Expected:

```text
Either there is nothing left to commit, or an empty validation checkpoint commit is created if your execution style requires it.
```
