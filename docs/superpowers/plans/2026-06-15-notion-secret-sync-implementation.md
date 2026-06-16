# Notion Secret Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make new Nextion Notion-backed projects sync `NOTION_DATA_SOURCE_ID` and `NOTION_PAGES_DATA_SOURCE_ID` to Worker secrets during provisioned deploys, and let existing projects repair the same drift through `nextion update`.

**Architecture:** Extend the existing provision secret-sync helper in `packages/create-nextion-app/src/provision/index.ts` so the first live deploy writes all required production Notion secrets, then replace the placeholder provision-repair inspector with a real Cloudflare secret drift detector that emits safe unified-update entries. Keep all production sync on the existing `wrangler secret put` path instead of moving ids into public `wrangler.jsonc` vars.

**Tech Stack:** TypeScript, Vitest, Wrangler CLI integration helpers, Clack prompts, existing Nextion unified update pipeline

---

### Task 1: Expand Provision Secret Sync Coverage

**Files:**
- Modify: `packages/create-nextion-app/src/provision/index.ts`
- Test: `packages/create-nextion-app/src/provision/index.test.ts`

- [ ] **Step 1: Write the failing test for required Notion ids**

```ts
it("writes required Notion ids to worker secrets during provisioned deploys", async () => {
  const wireInputs: WireInputs = {
    d1DatabaseId: "db-id",
    kvNamespaceId: "kv-id",
    vinextKvNamespaceId: "vinext-kv-id",
    notionToken: "secret-token",
    notionDataSourceId: "content-ds",
    notionPagesDataSourceId: "pages-ds",
  };

  await expect(
    _internal.setProvisionedWorkerSecrets({
      projectDir: "/tmp/demo",
      wireInputs,
      requireNotionSecrets: true,
    })
  ).resolves.toBe(true);

  expect(setWorkerSecretMock).toHaveBeenCalledWith(
    "NOTION_DATA_SOURCE_ID",
    "content-ds",
    "/tmp/demo",
    ["content-ds"]
  );
  expect(setWorkerSecretMock).toHaveBeenCalledWith(
    "NOTION_PAGES_DATA_SOURCE_ID",
    "pages-ds",
    "/tmp/demo",
    ["pages-ds"]
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- --run packages/create-nextion-app/src/provision/index.test.ts
```

Expected: FAIL because `setProvisionedWorkerSecrets()` currently only writes `TURNSTILE_SECRET_KEY` and `NOTION_TOKEN`.

- [ ] **Step 3: Replace the old skip-ids test with the new expectation**

```ts
it("writes all required Notion production secrets when available", async () => {
  const wireInputs: WireInputs = {
    d1DatabaseId: "db-id",
    kvNamespaceId: "kv-id",
    vinextKvNamespaceId: "vinext-kv-id",
    turnstileSecret: "turnstile-secret",
    notionToken: "secret-token",
    notionDataSourceId: "content-ds",
    notionPagesDataSourceId: "pages-ds",
    notionBlocksDataSourceId: "blocks-ds",
    notionSiteSettingsDataSourceId: "settings-ds",
  };

  await expect(
    _internal.setProvisionedWorkerSecrets({
      projectDir: "/tmp/demo",
      wireInputs,
      requireNotionSecrets: true,
    })
  ).resolves.toBe(true);

  expect(setWorkerSecretMock).toHaveBeenCalledTimes(4);
  expect(setWorkerSecretMock).toHaveBeenNthCalledWith(
    1,
    "TURNSTILE_SECRET_KEY",
    "turnstile-secret",
    "/tmp/demo",
    ["turnstile-secret"]
  );
  expect(setWorkerSecretMock).toHaveBeenNthCalledWith(
    2,
    "NOTION_TOKEN",
    "secret-token",
    "/tmp/demo",
    ["secret-token"]
  );
  expect(setWorkerSecretMock).toHaveBeenNthCalledWith(
    3,
    "NOTION_DATA_SOURCE_ID",
    "content-ds",
    "/tmp/demo",
    ["content-ds"]
  );
  expect(setWorkerSecretMock).toHaveBeenNthCalledWith(
    4,
    "NOTION_PAGES_DATA_SOURCE_ID",
    "pages-ds",
    "/tmp/demo",
    ["pages-ds"]
  );
});
```

- [ ] **Step 4: Add a missing-required-value test**

```ts
it("throws when required Notion content ids are missing", async () => {
  const wireInputs: WireInputs = {
    d1DatabaseId: "db-id",
    kvNamespaceId: "kv-id",
    vinextKvNamespaceId: "vinext-kv-id",
    notionToken: "secret-token",
    notionDataSourceId: "",
    notionPagesDataSourceId: "pages-ds",
  };

  await expect(
    _internal.setProvisionedWorkerSecrets({
      projectDir: "/tmp/demo",
      wireInputs,
      requireNotionSecrets: true,
    })
  ).rejects.toThrow(
    "failed to set NOTION_DATA_SOURCE_ID; production content will be empty until this secret is set"
  );
});
```

- [ ] **Step 5: Implement minimal multi-secret sync in provision**

```ts
  await putSecret("TURNSTILE_SECRET_KEY", wireInputs.turnstileSecret, false);
  await putSecret("NOTION_TOKEN", wireInputs.notionToken, requireNotionSecrets);
  await putSecret(
    "NOTION_DATA_SOURCE_ID",
    wireInputs.notionDataSourceId,
    requireNotionSecrets
  );
  await putSecret(
    "NOTION_PAGES_DATA_SOURCE_ID",
    wireInputs.notionPagesDataSourceId,
    requireNotionSecrets
  );
```

Also tighten the helper so required values fail fast instead of silently returning:

```ts
  const putSecret = async (
    name: string,
    value: string | undefined,
    required: boolean
  ) => {
    if (!value) {
      if (required) {
        throw new Error(
          `failed to set ${name}; production content will be empty until this secret is set:\nmissing local value`
        );
      }
      return;
    }
```

- [ ] **Step 6: Run tests to verify provision sync now passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- --run packages/create-nextion-app/src/provision/index.test.ts
```

Expected: PASS with the new required Notion secret coverage.

- [ ] **Step 7: Commit**

```bash
git add packages/create-nextion-app/src/provision/index.ts packages/create-nextion-app/src/provision/index.test.ts
git commit -m "fix: sync notion datasource ids during provision"
```

### Task 2: Build Real Cloudflare Secret Drift Inspection

**Files:**
- Modify: `packages/create-nextion-app/src/provision/inspect.ts`
- Modify: `packages/create-nextion-app/src/provision/repair.ts`
- Test: `packages/create-nextion-app/src/provision/repair.test.ts`

- [ ] **Step 1: Write the failing repair inspector test for missing remote secrets**

Add a real test case to `repair.test.ts`:

```ts
it("emits safe cloudflare repair entries for missing notion worker secrets", async () => {
  const entries = await inspectProvisionRepair(context);

  expect(entries.map((entry) => entry.label)).toEqual([
    "cloudflare-secret:NOTION_DATA_SOURCE_ID",
    "cloudflare-secret:NOTION_PAGES_DATA_SOURCE_ID",
  ]);
  expect(entries.every((entry) => entry.risk === "safe")).toBe(true);
  expect(entries.every((entry) => entry.group === "cloudflareBinding")).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- --run packages/create-nextion-app/src/provision/repair.test.ts
```

Expected: FAIL because `inspectProvisionRepair()` currently returns a single placeholder entry.

- [ ] **Step 3: Add inspect-time dependency seams before implementing behavior**

Create small internal helpers in `inspect.ts` so tests can stub them:

```ts
type LocalNotionSecretState = {
  notionToken?: string;
  notionDataSourceId?: string;
  notionPagesDataSourceId?: string;
};

async function readLocalNotionSecretState(projectDir: string): Promise<LocalNotionSecretState> {
  void projectDir;
  return {};
}

async function listRemoteWorkerSecretNames(projectDir: string): Promise<Set<string>> {
  void projectDir;
  return new Set();
}
```

- [ ] **Step 4: Implement local `.dev.vars` parsing**

In `inspect.ts`, add a tiny parser:

```ts
function parseEnvLike(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    out[match[1]] = match[2];
  }
  return out;
}
```

And use it:

```ts
async function readLocalNotionSecretState(projectDir: string): Promise<LocalNotionSecretState> {
  const devVarsPath = path.join(projectDir, ".dev.vars");
  const raw = await readFile(devVarsPath, "utf8");
  const env = parseEnvLike(raw);
  return {
    notionToken: env.NOTION_TOKEN?.trim() || undefined,
    notionDataSourceId: env.NOTION_DATA_SOURCE_ID?.trim() || undefined,
    notionPagesDataSourceId: env.NOTION_PAGES_DATA_SOURCE_ID?.trim() || undefined,
  };
}
```

- [ ] **Step 5: Implement remote secret-name listing with Wrangler JSON output**

In `inspect.ts`, add a helper that uses the existing shell wrapper pattern:

```ts
async function listRemoteWorkerSecretNames(projectDir: string): Promise<Set<string>> {
  const result = await run("wrangler", ["secret", "list", "--format", "json"], {
    cwd: projectDir,
  });
  if (result.code !== 0) {
    throw new Error(`wrangler secret list failed:\n${result.stderr || result.stdout}`);
  }
  const parsed = JSON.parse(result.stdout) as Array<{ name?: string }>;
  return new Set(parsed.map((entry) => String(entry.name ?? "").trim()).filter(Boolean));
}
```

- [ ] **Step 6: Replace the placeholder repair entry with secret-specific entries**

Implement `inspectProvisionRepair()` like this:

```ts
export async function inspectProvisionRepair(
  context: ProjectContext
): Promise<UnifiedUpdateEntry[]> {
  const local = await readLocalNotionSecretState(context.projectDir);
  const remoteNames = await listRemoteWorkerSecretNames(context.projectDir);
  const entries: UnifiedUpdateEntry[] = [];

  const addSecretEntry = (name: string, value: string | undefined) => {
    if (!value) return;
    if (remoteNames.has(name)) return;
    entries.push({
      label: `cloudflare-secret:${name}`,
      kind: "cloudflare",
      group: "cloudflareBinding",
      risk: "safe",
      async apply() {
        await setWorkerSecret(name, value, context.projectDir, [value]);
      },
    });
  };

  addSecretEntry("NOTION_DATA_SOURCE_ID", local.notionDataSourceId);
  addSecretEntry("NOTION_PAGES_DATA_SOURCE_ID", local.notionPagesDataSourceId);
  return entries;
}
```

- [ ] **Step 7: Add a skip test for projects without local ids**

```ts
it("skips notion secret repair when local ids are absent", async () => {
  const entries = await inspectProvisionRepair(contextWithoutLocalNotionIds);
  expect(entries).toEqual([]);
});
```

- [ ] **Step 8: Run repair tests to verify the inspector works**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- --run packages/create-nextion-app/src/provision/repair.test.ts
```

Expected: PASS with safe secret repair entries replacing the placeholder.

- [ ] **Step 9: Commit**

```bash
git add packages/create-nextion-app/src/provision/inspect.ts packages/create-nextion-app/src/provision/repair.test.ts packages/create-nextion-app/src/provision/repair.ts
git commit -m "fix: inspect missing notion worker secrets"
```

### Task 3: Make Update Output and Inspector Tests Match Real Behavior

**Files:**
- Modify: `packages/create-nextion-app/src/cli-nextion.test.ts`
- Modify: `packages/create-nextion-app/src/update/unified.ts`
- Test: `packages/create-nextion-app/src/cli-nextion.test.ts`

- [ ] **Step 1: Write the failing CLI summary expectation**

Add a focused test:

```ts
it("prints cloudflare secret repair labels in unified update summary", async () => {
  inspectProvisionRepairMock.mockResolvedValueOnce([
    {
      label: "cloudflare-secret:NOTION_DATA_SOURCE_ID",
      kind: "cloudflare",
      group: "cloudflareBinding",
      risk: "safe",
      apply: vi.fn(),
    },
  ]);

  await main(["update"]);

  expect(logInfoMock).toHaveBeenCalledWith("safe updates:");
  expect(logInfoMock).toHaveBeenCalledWith(
    "  - cloudflare-secret:NOTION_DATA_SOURCE_ID"
  );
});
```

- [ ] **Step 2: Run the CLI test to verify current behavior**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- --run packages/create-nextion-app/src/cli-nextion.test.ts
```

Expected: PASS and the new assertion locks the `cloudflare-secret:*` label in the printed update summary. If it fails, treat that as a signal to adjust only the CLI test fixture or summary formatting in Step 3, not to weaken the assertion.

- [ ] **Step 3: Tighten summary handling only if the new test requires it**

If needed, keep `formatUnifiedUpdateSummary()` unchanged except for a small helper to stabilize ordering:

```ts
function pushEntryGroup(lines: string[], title: string, entries: UnifiedUpdateEntry[]) {
  if (entries.length === 0) return;
  lines.push(title);
  for (const entry of entries) {
    lines.push(`  - ${entry.label}`);
  }
}
```

Use it in `formatUnifiedUpdateSummary()` only if the new test exposes duplicated or unstable output.

- [ ] **Step 4: Run CLI tests**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- --run packages/create-nextion-app/src/cli-nextion.test.ts
```

Expected: PASS and show the new `cloudflare-secret:*` labels in the summary path.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/cli-nextion.test.ts packages/create-nextion-app/src/update/unified.ts
git commit -m "test: cover notion secret repair summary"
```

### Task 4: End-to-End Regression Pass

**Files:**
- Modify: `packages/create-nextion-app/src/provision/index.test.ts`
- Modify: `packages/create-nextion-app/src/provision/repair.test.ts`
- Modify: `packages/create-nextion-app/src/cli-nextion.test.ts`

- [ ] **Step 1: Run the focused package test suite**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test
```

Expected: PASS for all create-nextion-app tests with the new Notion secret sync behavior.

- [ ] **Step 2: Run package typecheck**

Run:

```bash
pnpm --filter @notionx/create-nextion-app typecheck
```

Expected: PASS with no new type errors.

- [ ] **Step 3: Run package lint**

Run:

```bash
pnpm --filter @notionx/create-nextion-app lint
```

Expected: PASS with no new lint issues.

- [ ] **Step 4: Run the top-level release check that exercises workspace expectations**

Run:

```bash
pnpm run release:check:create
```

Expected: PASS so the change fits the repo's existing release gate for the scaffolder package.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/provision/index.test.ts packages/create-nextion-app/src/provision/repair.test.ts packages/create-nextion-app/src/cli-nextion.test.ts packages/create-nextion-app/src/provision/index.ts packages/create-nextion-app/src/provision/inspect.ts packages/create-nextion-app/src/update/unified.ts
git commit -m "fix: repair missing notion worker secrets"
```

### Task 5: Manual Smoke Validation For `digwis`

**Files:**
- Modify: none
- Verify: `/Users/zhao/项目/Cloudflare/digwis/.dev.vars`
- Verify: `/Users/zhao/项目/Cloudflare/digwis/.nextion/scaffold.json`

- [ ] **Step 1: Build or link the updated CLI locally**

Run:

```bash
pnpm --filter @notionx/create-nextion-app build
```

Expected: PASS and produce updated CLI artifacts.

- [ ] **Step 2: Run update against the existing `digwis` project**

Run:

```bash
cd /Users/zhao/项目/Cloudflare/digwis
npx nextion update
```

Expected: safe updates include:

```text
cloudflare-secret:NOTION_DATA_SOURCE_ID
cloudflare-secret:NOTION_PAGES_DATA_SOURCE_ID
```

- [ ] **Step 3: Verify idempotency**

Run:

```bash
npx nextion update
```

Expected: the second run shows no missing Notion secret repair entries.

- [ ] **Step 4: Verify the live blog route**

Run:

```bash
curl -I https://digwis.moviebluebook.workers.dev/blog
```

Expected: `HTTP/2 200` and the public page no longer renders the empty "No blog posts published yet." state for already-published content.

- [ ] **Step 5: Commit only if smoke validation required code tweaks**

```bash
git add packages/create-nextion-app/src/provision/index.ts packages/create-nextion-app/src/provision/index.test.ts packages/create-nextion-app/src/provision/inspect.ts packages/create-nextion-app/src/provision/repair.test.ts packages/create-nextion-app/src/cli-nextion.test.ts packages/create-nextion-app/src/update/unified.ts
git commit -m "fix: stabilize notion secret sync smoke flow"
```
