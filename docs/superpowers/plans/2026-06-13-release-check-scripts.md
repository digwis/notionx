# Release Check Scripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add root `package.json` scripts for fast release-check commands during the current high-churn development phase.

**Architecture:** Keep the implementation minimal by only updating the root `package.json`. The new scripts compose existing package commands instead of introducing new script files or custom logic, which keeps the change easy to audit and low-risk.

**Tech Stack:** pnpm, package.json scripts, Changesets

---

### Task 1: Add Root Release Check Scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Inspect the current root scripts**

Run:

```bash
node -e 'const pkg=require("./package.json"); console.log(pkg.scripts);'
```

Expected:

```text
The output includes `build`, `test`, `lint`, `typecheck`, `nextion:doctor`, and `tools:build`, but does not include any `release:check*` scripts yet.
```

- [ ] **Step 2: Add the new root scripts**

Update the `scripts` block in `package.json` so it includes these exact entries:

```json
{
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "dev:moviebluebook": "pnpm --filter @nextion/moviebluebook dev",
    "nextion:doctor": "pnpm --filter @notionx/core doctor",
    "tools:build": "pnpm --filter @notionx/create-nextion-app build",
    "release:check": "pnpm -r typecheck && pnpm -r lint && pnpm changeset status --help",
    "release:check:core": "pnpm --filter @notionx/core typecheck && pnpm --filter @notionx/core lint",
    "release:check:create": "pnpm --filter @notionx/create-nextion-app test",
    "release:check:skill": "pnpm --filter @notionx/skill typecheck && pnpm --filter @notionx/skill lint",
    "prepare": "husky"
  }
}
```

- [ ] **Step 3: Verify the new scripts are registered**

Run:

```bash
node -e 'const pkg=require("./package.json"); console.log(Object.keys(pkg.scripts).filter(k=>k.startsWith("release:check")).sort());'
```

Expected:

```text
[
  'release:check',
  'release:check:core',
  'release:check:create',
  'release:check:skill'
]
```

- [ ] **Step 4: Commit**

Run:

```bash
git add package.json
git commit -m "chore: add release check scripts"
```

### Task 2: Run Focused Command Verification

**Files:**
- Verify: `package.json`

- [ ] **Step 1: Run the lightest command variants**

Run:

```bash
pnpm run release:check:skill
pnpm run release:check:create
```

Expected:

```text
`release:check:skill` runs `@notionx/skill` typecheck and lint successfully.
`release:check:create` runs `@notionx/create-nextion-app` tests successfully.
```

- [ ] **Step 2: Verify the top-level script command string**

Run:

```bash
node -e 'const pkg=require("./package.json"); console.log(pkg.scripts["release:check"]);'
```

Expected:

```text
pnpm -r typecheck && pnpm -r lint && pnpm changeset status --help
```

- [ ] **Step 3: Run diagnostics on the edited file**

Use the editor diagnostics tool on:

```text
/Users/zhao/项目/nextion/package.json
```

Expected:

```text
No new diagnostics are reported for the root package manifest.
```

- [ ] **Step 4: Commit**

Run:

```bash
git status --short -- package.json
git commit --allow-empty -m "chore: verify release check scripts"
```

Expected:

```text
Either no further changes remain, or an empty checkpoint commit is created if your execution flow wants a verification marker.
```
