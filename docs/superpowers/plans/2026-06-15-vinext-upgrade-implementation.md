# Vinext Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the latest compatible `vinext` upgrade in `digwis`, then update the scaffolder template to recommend that validated baseline.

**Architecture:** First treat `digwis` as the canary consumer project and upgrade only its `vinext`-related dependencies. If `typecheck`, `test`, and `build` pass there, apply the same validated baseline to the scaffolder template so future generated projects start from the newer recommendation without changing `nextion update` behavior.

**Tech Stack:** pnpm workspace, vinext, @vinext/cloudflare, TypeScript, Vitest

---

### Task 1: Upgrade `digwis` Canary Dependencies

**Files:**
- Modify: `/Users/zhao/项目/Cloudflare/digwis/package.json`
- Modify: `/Users/zhao/项目/Cloudflare/digwis/pnpm-lock.yaml`

- [ ] **Step 1: Update the dependency ranges in `digwis/package.json`**

```json
"@vinext/cloudflare": "^0.1.2",
"vinext": "^0.1.3"
```

- [ ] **Step 2: Refresh the lockfile**

Run: `pnpm update vinext @vinext/cloudflare`
Expected: `package.json` stays on the requested ranges and `pnpm-lock.yaml` resolves the new versions without peer dependency failures.

- [ ] **Step 3: Verify type safety**

Run: `pnpm typecheck`
Expected: exit code `0`

- [ ] **Step 4: Verify tests**

Run: `pnpm test`
Expected: exit code `0`

- [ ] **Step 5: Verify production build**

Run: `pnpm build`
Expected: exit code `0`

- [ ] **Step 6: Commit the canary upgrade if all checks pass**

```bash
git add /Users/zhao/项目/Cloudflare/digwis/package.json /Users/zhao/项目/Cloudflare/digwis/pnpm-lock.yaml
git commit -m "chore(digwis): upgrade vinext baseline"
```

### Task 2: Update Scaffolder Recommended Versions

**Files:**
- Modify: `/Users/zhao/项目/nextion/packages/create-nextion-app/src/templates/package.json.tmpl`

- [ ] **Step 1: Update the template dev dependency ranges**

```json
"@vinext/cloudflare": "^0.1.2",
"vinext": "^0.1.3"
```

- [ ] **Step 2: Validate the template package tests**

Run: `pnpm --filter @notionx/create-nextion-app test`
Expected: exit code `0`

- [ ] **Step 3: Commit the template baseline change**

```bash
git add /Users/zhao/项目/nextion/packages/create-nextion-app/src/templates/package.json.tmpl
git commit -m "chore(create-nextion-app): bump vinext template baseline"
```

### Task 3: Final Verification and Handoff

**Files:**
- No new files

- [ ] **Step 1: Re-check the monorepo release status**

Run: `pnpm release:status`
Expected: either a clean no-publish result or a clear changeset warning consistent with the current workspace state

- [ ] **Step 2: Summarize the resulting upgrade rule**

```text
- Existing consumer projects may upgrade compatible vinext releases directly.
- Scaffold/template updates happen only after a real project canary succeeds.
- `npx nextion update` remains reserved for scaffold-managed file/config alignment.
```

- [ ] **Step 3: Commit any required release metadata separately if you later decide to publish**

```bash
# No commit in this task by default.
# If publication is desired later, add a changeset in a separate follow-up change.
```
