# Notion Provision Stable Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@notionx/create-nextion-app` reuse scaffold-managed Notion databases by a stable scaffold marker before falling back to legacy title matching.

**Architecture:** Keep the change contained to the Notion provisioning layer. Add pure helper functions for scaffold marker parsing/merging, add a stable-key database lookup path that inspects Notion database metadata, and preserve the existing additive-only schema patch behavior. Thread a stable key from the provision call sites so content and Pages databases can be resolved independently, and upgrade legacy title-matched databases in place by writing the new marker after first reuse.

**Tech Stack:** TypeScript, Vitest, `ntn` CLI-backed Notion API helpers, Node child-process wrappers

---

## File Map

- Modify: `packages/create-nextion-app/src/provision/notion.ts`
  - Add stable marker helpers, description parsing/merging, stable-key lookup, and legacy upgrade path.
- Modify: `packages/create-nextion-app/src/provision/notion.test.ts`
  - Add pure helper tests and mocked provisioning lookup tests.
- Modify: `packages/create-nextion-app/src/provision/index.ts`
  - Pass stable keys from content/Pages provisioning call sites.
- Create if needed: `packages/create-nextion-app/src/provision/notion.fixtures.ts`
  - Only create if `notion.test.ts` becomes noisy; store shared fake Notion API payloads there.

## Task 1: Lock The Metadata Contract

**Files:**
- Modify: `packages/create-nextion-app/src/provision/notion.test.ts`
- Modify: `packages/create-nextion-app/src/provision/notion.ts`

- [ ] **Step 1: Add failing tests that codify the scaffold marker format and description merge behavior**

```ts
import { describe, expect, it } from "vitest";

import { _internal } from "./notion.js";

describe("stable scaffold markers", () => {
  it("builds the expected scaffold marker for a stable key", () => {
    expect(_internal.buildScaffoldMarker("content:blog")).toBe(
      "[nextion-scaffold] key=content:blog"
    );
  });

  it("extracts a stable key from description text", () => {
    expect(
      _internal.extractScaffoldKey(
        "Editorial notes\n[nextion-scaffold] key=pages:default"
      )
    ).toBe("pages:default");
  });

  it("appends a scaffold marker without removing user-authored description text", () => {
    expect(
      _internal.mergeDescriptionWithScaffoldMarker(
        "Editorial notes",
        "content:blog"
      )
    ).toBe("Editorial notes\n[nextion-scaffold] key=content:blog");
  });
});
```

- [ ] **Step 2: Run the focused test file and confirm the new cases fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/notion.test.ts
```

Expected: FAIL with errors such as `_internal.buildScaffoldMarker is not a function` and `_internal.extractScaffoldKey is not a function`.

- [ ] **Step 3: Implement the minimal pure helpers in `notion.ts`**

Add these helpers near the existing plain-text and database metadata helpers:

```ts
const SCAFFOLD_MARKER_PREFIX = "[nextion-scaffold] key=";

function buildScaffoldMarker(stableKey: string): string {
  return `${SCAFFOLD_MARKER_PREFIX}${stableKey.trim()}`;
}

function extractScaffoldKey(description: string): string | null {
  const match = description.match(/\[nextion-scaffold\] key=([^\n\r]+)/);
  return match?.[1]?.trim() || null;
}

function mergeDescriptionWithScaffoldMarker(
  existingDescription: string,
  stableKey: string
): string {
  const marker = buildScaffoldMarker(stableKey);
  if (extractScaffoldKey(existingDescription) === stableKey) {
    return existingDescription.trim();
  }
  const trimmed = existingDescription.trim();
  return trimmed ? `${trimmed}\n${marker}` : marker;
}
```

Also expose them in `_internal`:

```ts
export const _internal = {
  notionPropertyType,
  buildProperties,
  buildPageProperties,
  buildSitePagePayload,
  resolveTitlePropertyName,
  buildSamplePage,
  sampleSitePages,
  samplePostFor,
  buildScaffoldMarker,
  extractScaffoldKey,
  mergeDescriptionWithScaffoldMarker,
};
```

- [ ] **Step 4: Run the focused tests again**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/notion.test.ts
```

Expected: PASS for the new helper tests and all existing `notion.test.ts` cases.

- [ ] **Step 5: Commit the helper contract**

```bash
git add packages/create-nextion-app/src/provision/notion.ts packages/create-nextion-app/src/provision/notion.test.ts
git commit -m "test: lock notion scaffold marker helpers"
```

## Task 2: Teach Lookup To Read And Write Stable Markers

**Files:**
- Modify: `packages/create-nextion-app/src/provision/notion.ts`
- Modify: `packages/create-nextion-app/src/provision/notion.test.ts`

- [ ] **Step 1: Add failing tests for stable-key lookup and legacy upgrade behavior**

At the top of `notion.test.ts`, mock the shell module before importing `./notion.js`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const runNtnMock = vi.fn();
const runOrThrowNtnMock = vi.fn();

vi.mock("./shell.js", () => ({
  runNtn: runNtnMock,
  runOrThrowNtn: runOrThrowNtnMock,
}));
```

Add tests like:

```ts
describe("stable database reuse", () => {
  beforeEach(() => {
    runNtnMock.mockReset();
    runOrThrowNtnMock.mockReset();
  });

  it("reuses a database whose description already contains the stable key", async () => {
    runOrThrowNtnMock.mockResolvedValueOnce(
      JSON.stringify({
        results: [
          {
            object: "database",
            id: "db-stable",
            title: [{ plain_text: "Renamed Blog" }],
            description: [{ plain_text: "[nextion-scaffold] key=content:blog" }],
            parent: { page_id: "page-1234-page-1234-page-1234page1234" },
            data_sources: [{ id: "ds-stable" }],
            url: "https://www.notion.so/db-stable",
            last_edited_time: "2026-06-12T00:00:00.000Z",
          },
        ],
      })
    );
    runOrThrowNtnMock.mockResolvedValueOnce(
      JSON.stringify({ properties: { Name: { title: {} } } })
    );

    const result = await ensureNotionDatabase({
      apiToken: "token",
      parentPageId: "page-1234-page-1234-page-1234page1234",
      title: "Demo Blog",
      stableKey: "content:blog",
      locale: "en",
      fields: [{ key: "title", notionName: "Name" }],
      seedCount: 3,
    });

    expect(result.created).toBe(false);
    expect(result.databaseId).toBe("db-stable");
    expect(runOrThrowNtnMock).not.toHaveBeenCalledWith(
      expect.arrayContaining(["v1/databases", "-d", expect.any(String)]),
      expect.anything()
    );
  });

  it("upgrades a legacy title match by patching the scaffold marker", async () => {
    runOrThrowNtnMock
      .mockResolvedValueOnce(JSON.stringify({ results: [] }))
      .mockResolvedValueOnce(
        JSON.stringify({
          results: [
            {
              object: "database",
              id: "db-legacy",
              title: [{ plain_text: "Demo Blog" }],
              description: [],
              parent: { page_id: "page-1234-page-1234-page-1234page1234" },
              data_sources: [{ id: "ds-legacy" }],
              url: "https://www.notion.so/db-legacy",
            },
          ],
        })
      )
      .mockResolvedValueOnce(JSON.stringify({ properties: { Name: { title: {} } } }))
      .mockResolvedValueOnce(JSON.stringify({ id: "db-legacy" }));

    const result = await ensureNotionDatabase({
      apiToken: "token",
      parentPageId: "page-1234-page-1234-page-1234page1234",
      title: "Demo Blog",
      stableKey: "content:blog",
      locale: "en",
      fields: [{ key: "title", notionName: "Name" }],
      seedCount: 0,
    });

    expect(result.created).toBe(false);
    expect(runOrThrowNtnMock).toHaveBeenCalledWith(
      expect.arrayContaining(["api", "v1/databases/db-legacy", "-X", "PATCH"]),
      expect.objectContaining({ env: { NOTION_API_TOKEN: "token" } })
    );
  });
});
```

- [ ] **Step 2: Run the focused test file and verify the new cases fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/notion.test.ts
```

Expected: FAIL because `ensureNotionDatabase` does not accept `stableKey`, does not inspect descriptions, and never patches legacy databases.

- [ ] **Step 3: Implement description readers, patchers, and stable-key lookup**

In `notion.ts`, add metadata readers next to `databaseTitle(...)`:

```ts
function databaseDescription(input: Record<string, unknown>): string {
  return plainText(input.description);
}

function lastEditedTime(input: Record<string, unknown>): string {
  return typeof input.last_edited_time === "string" ? input.last_edited_time : "";
}
```

Add a writable patch helper:

```ts
async function patchDatabaseDescription(input: {
  apiToken: string;
  databaseId: string;
  existingDescription: string;
  stableKey: string;
}): Promise<void> {
  const description = [
    {
      type: "text",
      text: {
        content: mergeDescriptionWithScaffoldMarker(
          input.existingDescription,
          input.stableKey
        ),
      },
    },
  ];

  await runOrThrowNtn(
    [
      "api",
      `v1/databases/${input.databaseId}`,
      "-X",
      "PATCH",
      "-d",
      JSON.stringify({ description }),
    ],
    { env: { NOTION_API_TOKEN: input.apiToken } }
  );
}
```

Add a stable-key search helper:

```ts
async function findExistingDatabaseByStableKey(input: {
  apiToken: string;
  parentPageId: string;
  stableKey: string;
}): Promise<ExistingDatabaseInfo | null> {
  const stdout = await runOrThrowNtn(
    [
      "api",
      "v1/search",
      "-d",
      JSON.stringify({
        query: input.stableKey,
        filter: { property: "object", value: "database" },
        sort: { timestamp: "last_edited_time", direction: "descending" },
        page_size: 50,
      }),
    ],
    { env: { NOTION_API_TOKEN: input.apiToken } }
  );
  const raw = JSON.parse(stdout) as { results?: unknown[] };
  const expectedParent = compactNotionId(input.parentPageId);
  const matches = (raw.results ?? [])
    .filter((item): item is Record<string, unknown> => {
      if (!isRecord(item) || item.object !== "database") return false;
      const parentId = parentPageId(item);
      if (!parentId || compactNotionId(parentId) !== expectedParent) return false;
      return extractScaffoldKey(databaseDescription(item)) === input.stableKey;
    })
    .sort((a, b) => lastEditedTime(b).localeCompare(lastEditedTime(a)));

  const first = matches[0];
  if (!first) return null;
  return {
    databaseId: String(first.id),
    dataSourceId:
      firstDataSourceId(first) ??
      (await retrieveDatabaseInfo(input.apiToken, String(first.id))).dataSourceId,
    url: databaseUrl(String(first.id), first),
    description: databaseDescription(first),
  };
}
```

Extend `ExistingDatabaseInfo` with a description field:

```ts
interface ExistingDatabaseInfo {
  databaseId: string;
  dataSourceId: string;
  url: string;
  description: string;
}
```

- [ ] **Step 4: Update `ensureNotionDatabase` and `ensurePagesDatabase` to use stable-key-first resolution**

Change the inputs:

```ts
export interface NotionProvisionInput {
  apiToken: string;
  parentPageId: string;
  title: string;
  stableKey: string;
  locale?: string;
  fields: AnswersContentField[];
  seedCount: number;
}
```

Change the resolution flow:

```ts
const existingByStableKey = await findExistingDatabaseByStableKey({
  apiToken: input.apiToken,
  parentPageId: input.parentPageId,
  stableKey: input.stableKey,
});

const existing =
  existingByStableKey ??
  (await findExistingDatabaseByTitle({
    apiToken: input.apiToken,
    parentPageId: input.parentPageId,
    title: input.title,
  }));

if (existing && extractScaffoldKey(existing.description) !== input.stableKey) {
  await patchDatabaseDescription({
    apiToken: input.apiToken,
    databaseId: existing.databaseId,
    existingDescription: existing.description,
    stableKey: input.stableKey,
  });
}
```

After creating a new database, write the marker before seeding:

```ts
await patchDatabaseDescription({
  apiToken: input.apiToken,
  databaseId,
  existingDescription: "",
  stableKey: input.stableKey,
});
```

- [ ] **Step 5: Run the focused tests and make them pass**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/notion.test.ts
```

Expected: PASS for the new stable reuse tests plus the existing schema/sample page tests.

- [ ] **Step 6: Commit the lookup behavior**

```bash
git add packages/create-nextion-app/src/provision/notion.ts packages/create-nextion-app/src/provision/notion.test.ts
git commit -m "feat: reuse notion databases by stable scaffold key"
```

## Task 3: Thread Stable Keys From Provision Call Sites

**Files:**
- Modify: `packages/create-nextion-app/src/provision/index.ts`
- Modify: `packages/create-nextion-app/src/provision/notion.ts`
- Modify: `packages/create-nextion-app/src/provision/notion.test.ts`

- [ ] **Step 1: Add a failing test that the content provisioning path passes a stable key**

If `notion.test.ts` is already too dense, create `packages/create-nextion-app/src/provision/index.test.ts`; otherwise keep the test close to `notion.ts` and mock the exported function call shape.

Minimal test shape:

```ts
import { describe, expect, it, vi } from "vitest";

const ensureNotionDatabaseMock = vi.fn();
const ensurePagesDatabaseMock = vi.fn();

vi.mock("./notion.js", async () => {
  const actual = await vi.importActual<typeof import("./notion.js")>("./notion.js");
  return {
    ...actual,
    ensureNotionDatabase: ensureNotionDatabaseMock,
    ensurePagesDatabase: ensurePagesDatabaseMock,
  };
});
```

Expected assertion:

```ts
expect(ensureNotionDatabaseMock).toHaveBeenCalledWith(
  expect.objectContaining({
    stableKey: "content:blog",
  })
);
expect(ensurePagesDatabaseMock).toHaveBeenCalledWith(
  expect.objectContaining({
    contentSourceId: "blog",
  })
);
```

- [ ] **Step 2: Run the focused tests and confirm the call-shape check fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/notion.test.ts
```

If you created `index.test.ts`, run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/index.test.ts
```

Expected: FAIL because `provisionNotionContentAndPages(...)` still calls `ensureNotionDatabase(...)` without `stableKey`.

- [ ] **Step 3: Update the provision call sites**

In `packages/create-nextion-app/src/provision/index.ts`, change the content call to:

```ts
const content = await ensureNotionDatabase({
  apiToken,
  parentPageId,
  title: `${answers.projectName} ${answers.contentSource.title}`,
  stableKey: `content:${answers.contentSource.id}`,
  locale: answers.defaultLocale,
  fields: answers.contentSource.fields,
  seedCount,
});
```

Keep the Pages call explicit and unchanged in meaning:

```ts
const pages = await ensurePagesDatabase({
  apiToken,
  parentPageId,
  projectName: answers.projectName,
  contentSourceId: answers.contentSource.id,
  contentSourceTitle: answers.contentSource.title,
  contentSourceListPath: `/${answers.contentSource.id}`,
  locale: answers.defaultLocale,
});
```

In `ensurePagesDatabase(...)`, compute the stable key once:

```ts
const stableKey = "pages:default";
```

Then reuse it in both the stable-key lookup and post-create patch path.

- [ ] **Step 4: Run the targeted test files**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/notion.test.ts
```

If present:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/index.test.ts
```

Expected: PASS with stable key call shapes covered.

- [ ] **Step 5: Commit the wiring**

```bash
git add packages/create-nextion-app/src/provision/index.ts packages/create-nextion-app/src/provision/notion.ts packages/create-nextion-app/src/provision/notion.test.ts
git commit -m "feat: thread notion stable keys through provision flow"
```

## Task 4: Guard Additive-Only Schema Patching And Duplicate Matches

**Files:**
- Modify: `packages/create-nextion-app/src/provision/notion.test.ts`
- Modify: `packages/create-nextion-app/src/provision/notion.ts`

- [ ] **Step 1: Add failing tests for duplicate marker matches and additive-only schema behavior**

Add tests like:

```ts
it("selects the most recently edited database when duplicate stable markers exist", async () => {
  runOrThrowNtnMock.mockResolvedValueOnce(
    JSON.stringify({
      results: [
        {
          object: "database",
          id: "db-older",
          title: [{ plain_text: "Older" }],
          description: [{ plain_text: "[nextion-scaffold] key=content:blog" }],
          parent: { page_id: "page-1234-page-1234-page-1234page1234" },
          data_sources: [{ id: "ds-older" }],
          last_edited_time: "2026-06-01T00:00:00.000Z",
        },
        {
          object: "database",
          id: "db-newer",
          title: [{ plain_text: "Newer" }],
          description: [{ plain_text: "[nextion-scaffold] key=content:blog" }],
          parent: { page_id: "page-1234-page-1234-page-1234page1234" },
          data_sources: [{ id: "ds-newer" }],
          last_edited_time: "2026-06-12T00:00:00.000Z",
        },
      ],
    })
  );
  runOrThrowNtnMock.mockResolvedValueOnce(
    JSON.stringify({ properties: { Name: { title: {} } } })
  );

  const result = await ensureNotionDatabase({
    apiToken: "token",
    parentPageId: "page-1234-page-1234-page-1234page1234",
    title: "Demo Blog",
    stableKey: "content:blog",
    fields: [{ key: "title", notionName: "Name" }],
    seedCount: 0,
  });

  expect(result.databaseId).toBe("db-newer");
});

it("does not patch property types when the existing schema type differs", () => {
  const diff = _internal.missingPropertiesForPatch(
    { Published: { rich_text: {} } },
    { Published: { checkbox: {} }, Date: { date: {} } }
  );

  expect(diff.properties).toEqual({ Date: { date: {} } });
  expect(diff.warnings[0]).toContain('property "Published" is rich_text');
});
```

- [ ] **Step 2: Run the focused test file and verify the new cases fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/notion.test.ts
```

Expected: FAIL because `missingPropertiesForPatch` is not exposed to `_internal` and duplicate stable matches are not explicitly sorted or warned.

- [ ] **Step 3: Make the existing additive-only logic explicit and testable**

Expose the schema diff helper in `_internal`:

```ts
export const _internal = {
  notionPropertyType,
  buildProperties,
  buildPageProperties,
  buildSitePagePayload,
  resolveTitlePropertyName,
  buildSamplePage,
  sampleSitePages,
  samplePostFor,
  buildScaffoldMarker,
  extractScaffoldKey,
  mergeDescriptionWithScaffoldMarker,
  missingPropertiesForPatch,
};
```

When multiple stable matches exist, log a warning exactly once before reusing the newest match:

```ts
if (matches.length > 1) {
  console.warn(
    `[notion] found ${matches.length} databases with scaffold key "${input.stableKey}" under the parent page; reusing the most recently edited one.`
  );
}
```

- [ ] **Step 4: Run the focused tests again**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/notion.test.ts
```

Expected: PASS with duplicate selection and additive-only schema patch behavior locked in.

- [ ] **Step 5: Commit the guardrails**

```bash
git add packages/create-nextion-app/src/provision/notion.ts packages/create-nextion-app/src/provision/notion.test.ts
git commit -m "test: cover notion stable reuse edge cases"
```

## Task 5: Full Package Verification

**Files:**
- Modify: `packages/create-nextion-app/src/provision/notion.ts`
- Modify: `packages/create-nextion-app/src/provision/notion.test.ts`
- Modify: `packages/create-nextion-app/src/provision/index.ts`

- [ ] **Step 1: Run the focused Notion provision tests**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/notion.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the package test suite**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test
```

Expected: PASS with `render.test.ts` and `notion.test.ts` both green.

- [ ] **Step 3: Run TypeScript diagnostics for the package**

Run:

```bash
pnpm --filter @notionx/create-nextion-app build
```

Expected: PASS and templates copied into `dist/templates`.

- [ ] **Step 4: Review the diff for scope**

Run:

```bash
git diff -- packages/create-nextion-app/src/provision/notion.ts packages/create-nextion-app/src/provision/notion.test.ts packages/create-nextion-app/src/provision/index.ts
```

Expected: Only stable marker helpers, lookup flow, and related tests are changed.

- [ ] **Step 5: Commit the finished feature**

```bash
git add packages/create-nextion-app/src/provision/notion.ts packages/create-nextion-app/src/provision/notion.test.ts packages/create-nextion-app/src/provision/index.ts
git commit -m "feat: preserve notion database identity across reprovisioning"
```

## Self-Review

- Spec coverage: the plan covers stable keys, database metadata persistence, stable-key-first lookup, legacy title fallback, additive-only schema patching, duplicate-match handling, and targeted verification.
- Placeholder scan: no `TODO`, `TBD`, or “implement later” placeholders remain; every task includes file paths, code snippets, and concrete commands.
- Type consistency: `stableKey`, `content:<contentSourceId>`, and `pages:default` are named consistently across helper, lookup, and provision tasks.
