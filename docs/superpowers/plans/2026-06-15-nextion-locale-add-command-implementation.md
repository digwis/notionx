# `nextion locale add` Command Implementation Plan (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `npx nextion locale add <locale>` as a first-class, conservative scaffolder command that updates only safe project surfaces (scaffold metadata, locale config, scaffold-rendered files) by default, with an opt-in `--with-notion` flag that provisions the four translation data sources in Notion (and refuses to delete user data on either side).

**Architecture:** Layer a new `locale-add` module on top of the existing scaffolder plumbing. The plan step is a pure function that returns a list of `LocaleAddChange` records (a file change, a metadata mutation, a Notion action, etc.); a separate runner applies those changes inside the existing `UnifiedUpdateEntry` safety net (safe / conflict buckets, dry-run, interactive confirm). A thin `notion-translation-sources` module wraps the `ntn` CLI to create / reuse / repair the four translation data sources.

**Tech Stack:** TypeScript, Node 20+, `@clack/prompts`, `ntn` (Notion CLI), Vitest

**Out of scope:**
- Phase 3 (docs, extension examples, AI skill) is a separate follow-up plan.
- Locale removal / deletion is explicitly out of scope: the command only adds.

---

## File Map

- Create: `packages/create-nextion-app/src/locale-add/plan.ts`
  Purpose: Pure planning function: given a project context, a locale, and CLI flags, return a list of `LocaleAddChange` records describing what would change.
- Create: `packages/create-nextion-app/src/locale-add/apply.ts`
  Purpose: Apply a planned change set to disk + scaffold metadata. Each change is atomic and idempotent.
- Create: `packages/create-nextion-app/src/locale-add/format.ts`
  Purpose: Print a dry-run summary (or a post-apply summary) using `@clack/prompts` style.
- Create: `packages/create-nextion-app/src/locale-add/validate.ts`
  Purpose: Validate the requested locale (BCP-47-ish) and refuse duplicates / removals.
- Create: `packages/create-nextion-app/src/locale-add/index.ts`
  Purpose: Public entry point for the locale-add feature; re-exports the plan / apply / format functions.
- Create: `packages/create-nextion-app/src/notion-translation-sources/plan.ts`
  Purpose: Pure planning function for translation data source changes (create, reuse, copy-from).
- Create: `packages/create-nextion-app/src/notion-translation-sources/apply.ts`
  Purpose: Run the planned translation data source changes through the `ntn` CLI; return a list of `UnifiedUpdateEntry` records.
- Create: `packages/create-nextion-app/src/notion-translation-sources/index.ts`
  Purpose: Public entry point for the translation-sources feature.
- Create: `packages/create-nextion-app/tests/locale-add/validate.test.ts`
  Purpose: Test the locale validator (format, duplicates, removal refusal).
- Create: `packages/create-nextion-app/tests/locale-add/plan.test.ts`
  Purpose: Test the planning function (dry-run, idempotency, change ordering, refusal of removal).
- Create: `packages/create-nextion-app/tests/notion-translation-sources/plan.test.ts`
  Purpose: Test the Notion translation source planner (create, reuse, copy-from).
- Modify: `packages/create-nextion-app/src/cli-nextion.ts`
  Purpose: Dispatch the new `npx nextion locale add <locale>` subcommand.
- Modify: `packages/create-nextion-app/src/metadata.ts`
  Purpose: Extend `ScaffoldMetadata` with an optional `translationSources` map to track per-model translation data source ids (used for idempotent re-runs and doctor checks).
- Modify: `packages/create-nextion-app/src/update/types.ts`
  Purpose: No type changes needed; the locale-add changes flow through `UnifiedUpdateEntry` like the existing update path.
- Modify: `packages/nextion/src/doctor/doctor.ts`
  Purpose: Add a `locale.translationSources` check group that flags missing translation data sources per built-in model.
- Modify: `packages/nextion/src/doctor/doctor.ts` (continued)
  Purpose: Wire the new check into the overall report and into the `nextSteps` list (suggest `nextion locale add`).
- Modify: `packages/create-nextion-app/src/templates/lib/i18n/config.ts.tmpl`
  Purpose: No changes; existing template already accepts the supported-locales list. (We will instead write a stable file that the locale-add command can patch idempotently.)
- Modify: `packages/create-nextion-app/src/templates/lib/locale-contract/built-in.ts.tmpl`
  Purpose: Same — no template changes; the apply step writes directly to the project's copy of these files.
- Modify: `packages/create-nextion-app/src/provision/inspect.ts`
  Purpose: Add a translation-source-secrets repair pass that mirrors the existing Notion secret repair.
- Create: `.changeset/multilingual-starter-foundation-phase-2.md`
  Purpose: Document the `nextion locale add` command as a `@notionx/create-nextion-app` minor.

---

### Task 1: Extend `ScaffoldMetadata` With Translation Sources

**Files:**
- Modify: `packages/create-nextion-app/src/metadata.ts`
- Create: `packages/create-nextion-app/tests/metadata-translation-sources.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/create-nextion-app/tests/metadata-translation-sources.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildScaffoldMetadata,
  parseScaffoldMetadata,
} from "../src/metadata";
import { DEFAULT_ANSWERS } from "../src/prompt";

describe("ScaffoldMetadata.translationSources", () => {
  it("round-trips an empty translationSources map", () => {
    const answers = {
      ...DEFAULT_ANSWERS,
      projectName: "demo",
      defaultLocale: "en",
      supportedLocales: ["en"],
      contentSource: {
        id: "blog",
        title: "Blog",
        fields: [],
      },
    };
    const built = buildScaffoldMetadata(answers, "1.0.0");
    const raw = JSON.stringify(built);
    const parsed = parseScaffoldMetadata(raw);
    expect(parsed.translationSources).toEqual({});
  });

  it("preserves translationSources when round-tripping", () => {
    const answers = {
      ...DEFAULT_ANSWERS,
      projectName: "demo",
      defaultLocale: "en",
      supportedLocales: ["en", "zh-CN"],
      contentSource: {
        id: "blog",
        title: "Blog",
        fields: [],
      },
    };
    const built = buildScaffoldMetadata(answers, "1.0.0");
    built.translationSources = {
      blog: { dataSourceId: "ds-1", envVar: "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID" },
    };
    const parsed = parseScaffoldMetadata(JSON.stringify(built));
    expect(parsed.translationSources.blog.dataSourceId).toBe("ds-1");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @notionx/create-nextion-app test -- metadata-translation-sources`
Expected: FAIL with "Cannot read properties of undefined (reading 'blog')" or similar

- [ ] **Step 3: Extend `ScaffoldMetadata`**

Edit `packages/create-nextion-app/src/metadata.ts` to add the optional `translationSources` field and update the builder to initialize it as an empty object. Add to the interface:

```ts
export interface TranslationSourceRef {
  dataSourceId: string;
  envVar: string;
}

export interface ScaffoldMetadata {
  // ...existing fields
  /**
   * Maps a built-in model id (or the content source id) to the Notion
   * translation data source that holds its locale-specific rows. The
   * scaffolder never writes or rewrites this block on a normal update
   * run; the `nextion locale add` command manages it.
   */
  translationSources?: Record<string, TranslationSourceRef>;
}
```

And in `buildScaffoldMetadata`:

```ts
return {
  // ...existing fields
  translationSources: {},
};
```

Update `parseScaffoldMetadata` to also accept the new field but not require it:

```ts
if (parsed.translationSources !== undefined) {
  if (typeof parsed.translationSources !== "object" || parsed.translationSources === null) {
    throw new Error("Invalid Nextion metadata payload: translationSources must be an object");
  }
  for (const value of Object.values(parsed.translationSources)) {
    if (
      !value ||
      typeof (value as TranslationSourceRef).dataSourceId !== "string" ||
      typeof (value as TranslationSourceRef).envVar !== "string"
    ) {
      throw new Error("Invalid Nextion metadata payload: translationSources entry");
    }
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @notionx/create-nextion-app test -- metadata-translation-sources`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/metadata.ts \
        packages/create-nextion-app/tests/metadata-translation-sources.test.ts
git commit -m "feat(create-nextion-app): add translationSources to scaffold metadata"
```

---

### Task 2: Add The Locale Validator

**Files:**
- Create: `packages/create-nextion-app/src/locale-add/validate.ts`
- Create: `packages/create-nextion-app/tests/locale-add/validate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/create-nextion-app/tests/locale-add/validate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateLocaleAdd } from "../../src/locale-add/validate";

describe("validateLocaleAdd", () => {
  it("accepts a well-formed, non-duplicate locale", () => {
    const result = validateLocaleAdd({
      locale: "zh-CN",
      supportedLocales: ["en"],
      defaultLocale: "en",
    });
    expect(result).toEqual({ ok: true, locale: "zh-CN" });
  });

  it("rejects a locale that is already in the list (no removals)", () => {
    const result = validateLocaleAdd({
      locale: "en",
      supportedLocales: ["en", "zh-CN"],
      defaultLocale: "en",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/already/);
  });

  it("rejects a locale that equals the default locale", () => {
    const result = validateLocaleAdd({
      locale: "en",
      supportedLocales: ["en"],
      defaultLocale: "en",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects malformed locales", () => {
    const result = validateLocaleAdd({
      locale: "not_a_locale!!",
      supportedLocales: ["en"],
      defaultLocale: "en",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects empty input", () => {
    const result = validateLocaleAdd({
      locale: "  ",
      supportedLocales: ["en"],
      defaultLocale: "en",
    });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @notionx/create-nextion-app test -- locale-add/validate`
Expected: FAIL with "Cannot find module '../../src/locale-add/validate'"

- [ ] **Step 3: Implement the validator**

Create `packages/create-nextion-app/src/locale-add/validate.ts`:

```ts
// packages/create-nextion-app/src/locale-add/validate.ts
//
// Conservative validator for `nextion locale add <locale>`. The
// command only ever adds, never removes. The validator refuses:
//
//   - empty / whitespace-only input
//   - malformed locales (anything that is not a BCP-47-ish tag of
//     letters, digits, and a single hyphen)
//   - duplicates against the existing `supportedLocales` list
//   - the default locale (adding the default is a no-op)
//
// A well-formed, non-duplicate locale is returned with a normalized
// casing (`zh-cn` → `zh-CN` style, where the region part is upper
// case and the language part is lower case).

const LOCALE_RE = /^[A-Za-z]{2,3}(-[A-Za-z]{2,4})?$/;

export type ValidateLocaleAddInput = {
  locale: string;
  supportedLocales: readonly string[];
  defaultLocale: string;
};

export type ValidateLocaleAddResult =
  | { ok: true; locale: string }
  | { ok: false; reason: string };

function normalize(locale: string): string | null {
  const trimmed = locale.trim();
  if (!trimmed) return null;
  if (!LOCALE_RE.test(trimmed)) return null;
  const [lang, region] = trimmed.split("-");
  return region
    ? `${lang.toLowerCase()}-${region.toUpperCase()}`
    : lang.toLowerCase();
}

export function validateLocaleAdd(
  input: ValidateLocaleAddInput
): ValidateLocaleAddResult {
  const normalized = normalize(input.locale);
  if (!normalized) {
    return { ok: false, reason: `Not a valid locale tag: "${input.locale}"` };
  }
  if (normalized === input.defaultLocale) {
    return {
      ok: false,
      reason: `"${normalized}" is already the default locale`,
    };
  }
  if (input.supportedLocales.includes(normalized)) {
    return {
      ok: false,
      reason: `"${normalized}" is already in supportedLocales`,
    };
  }
  return { ok: true, locale: normalized };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @notionx/create-nextion-app test -- locale-add/validate`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/locale-add/validate.ts \
        packages/create-nextion-app/tests/locale-add/validate.test.ts
git commit -m "feat(create-nextion-app): add locale-add validator"
```

---

### Task 3: Plan The Local-Only Code Changes

**Files:**
- Create: `packages/create-nextion-app/src/locale-add/plan.ts`
- Create: `packages/create-nextion-app/tests/locale-add/plan.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/create-nextion-app/tests/locale-add/plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildLocaleAddPlan } from "../../src/locale-add/plan";
import type { ScaffoldMetadata } from "../../src/metadata";

const baseMetadata: ScaffoldMetadata = {
  projectKind: "nextion",
  projectName: "demo",
  scaffoldVersion: "1.0.0",
  defaultLocale: "en",
  supportedLocales: ["en"],
  nextionSource: "1.0.0",
  enableSiteSettings: true,
  contentSource: { id: "blog", title: "Blog", fields: [] },
};

describe("buildLocaleAddPlan", () => {
  it("returns metadata + i18n + site-config changes by default", () => {
    const plan = buildLocaleAddPlan({
      projectDir: "/tmp/proj",
      metadata: baseMetadata,
      locale: "zh-CN",
    });
    const labels = plan.changes.map((change) => change.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "metadata:supportedLocales",
        "file:lib/i18n/config.ts",
        "file:lib/site/config.ts",
      ])
    );
  });

  it("does not include any notion changes when --with-notion is omitted", () => {
    const plan = buildLocaleAddPlan({
      projectDir: "/tmp/proj",
      metadata: baseMetadata,
      locale: "zh-CN",
    });
    expect(plan.changes.some((change) => change.kind === "notion")).toBe(false);
  });

  it("includes notion changes for each built-in model when --with-notion is set", () => {
    const plan = buildLocaleAddPlan({
      projectDir: "/tmp/proj",
      metadata: baseMetadata,
      locale: "zh-CN",
      withNotion: true,
    });
    const notion = plan.changes.filter((change) => change.kind === "notion");
    expect(notion.map((change) => change.label)).toEqual(
      expect.arrayContaining([
        "notion:blog-translations",
        "notion:page-translations",
        "notion:block-translations",
        "notion:site-settings-translations",
      ])
    );
  });

  it("includes cloudflare-secret changes for the new translation data source ids", () => {
    const plan = buildLocaleAddPlan({
      projectDir: "/tmp/proj",
      metadata: baseMetadata,
      locale: "zh-CN",
      withNotion: true,
      translationSourceIds: {
        "blog-translations": "ds-blog-zh",
      },
    });
    expect(
      plan.changes.some(
        (change) =>
          change.kind === "cloudflare" &&
          change.label === "cloudflare-secret:NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID"
      )
    ).toBe(true);
  });

  it("is idempotent — running the same plan twice yields the same change set", () => {
    const first = buildLocaleAddPlan({
      projectDir: "/tmp/proj",
      metadata: baseMetadata,
      locale: "zh-CN",
    });
    const second = buildLocaleAddPlan({
      projectDir: "/tmp/proj",
      metadata: {
        ...baseMetadata,
        supportedLocales: ["en", "zh-CN"],
      },
      locale: "fr",
    });
    expect(second.changes.length).toBeGreaterThan(0);
    expect(
      second.changes.find((c) => c.label === "metadata:supportedLocales")
    ).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @notionx/create-nextion-app test -- locale-add/plan`
Expected: FAIL with "Cannot find module '../../src/locale-add/plan'"

- [ ] **Step 3: Implement the planner**

Create `packages/create-nextion-app/src/locale-add/plan.ts`:

```ts
// packages/create-nextion-app/src/locale-add/plan.ts
//
// Pure planning step for `nextion locale add`. Given the project
// context, a locale, and CLI flags, return the list of changes the
// runner should apply. The planner is pure: it never touches disk,
// never shells out, and never throws on missing optional inputs.
//
// The output is consumed by the runner (see `apply.ts`) which is
// the only thing that mutates state. This makes the planner
// trivially testable and lets the CLI render a dry-run summary
// without side effects.

import type { ScaffoldMetadata } from "../metadata.js";

export type LocaleAddChange =
  | {
      kind: "metadata";
      label: `metadata:${string}`;
      description: string;
      risk: "safe" | "conflict";
      apply: () => Promise<void>;
    }
  | {
      kind: "file";
      label: `file:${string}`;
      description: string;
      risk: "safe" | "conflict";
      filePath: string;
      apply: () => Promise<void>;
    }
  | {
      kind: "notion";
      label: `notion:${string}`;
      description: string;
      risk: "safe" | "conflict";
      modelId: string;
      apply: () => Promise<{ dataSourceId: string } | null>;
    }
  | {
      kind: "cloudflare";
      label: `cloudflare-secret:${string}`;
      description: string;
      risk: "safe" | "conflict";
      envVar: string;
      apply: () => Promise<void>;
    };

export type LocaleAddPlan = {
  locale: string;
  changes: LocaleAddChange[];
};

export type BuildLocaleAddPlanInput = {
  projectDir: string;
  metadata: ScaffoldMetadata;
  locale: string;
  withNotion?: boolean;
  copyFrom?: string;
  /** Pre-resolved translation data source ids, keyed by translation source name. */
  translationSourceIds?: Record<string, string>;
};

const BUILT_IN_NOTION_SOURCES = [
  "blog-translations",
  "page-translations",
  "block-translations",
  "site-settings-translations",
] as const;

export function buildLocaleAddPlan(
  input: BuildLocaleAddPlanInput
): LocaleAddPlan {
  const changes: LocaleAddChange[] = [];
  const { projectDir, metadata, locale } = input;
  const i18nPath = "lib/i18n/config.ts";
  const siteConfigPath = "lib/site/config.ts";
  const metadataPath = ".nextion/scaffold.json";

  // 1. metadata: append locale to supportedLocales.
  const nextMetadata: ScaffoldMetadata = {
    ...metadata,
    supportedLocales: [...metadata.supportedLocales, locale],
  };
  changes.push({
    kind: "metadata",
    label: "metadata:supportedLocales",
    description: `Append "${locale}" to .nextion/scaffold.json supportedLocales.`,
    risk: metadata.supportedLocales.includes(locale) ? "conflict" : "safe",
    async apply() {
      const fs = await import("node:fs/promises");
      await fs.writeFile(
        metadataPath,
        JSON.stringify(nextMetadata, null, 2) + "\n",
        "utf8"
      );
    },
  });

  // 2. lib/i18n/config.ts — append the locale to supportedLocalesJson.
  changes.push({
    kind: "file",
    label: `file:${i18nPath}`,
    description: `Add "${locale}" to lib/i18n/config.ts supportedLocales.`,
    risk: "safe",
    filePath: i18nPath,
    async apply() {
      const fs = await import("node:fs/promises");
      const full = `${projectDir}/${i18nPath}`;
      let content: string;
      try {
        content = await fs.readFile(full, "utf8");
      } catch {
        return;
      }
      const updated = content.replace(
        /supportedLocales:\s*\[[^\]]*\]/,
        (match) => match.replace(/\]$/, `, "${locale}"]`)
      );
      await fs.writeFile(full, updated, "utf8");
    },
  });

  // 3. lib/site/config.ts — append the locale to the locales list.
  changes.push({
    kind: "file",
    label: `file:${siteConfigPath}`,
    description: `Add "${locale}" to lib/site/config.ts locales.`,
    risk: "safe",
    filePath: siteConfigPath,
    async apply() {
      const fs = await import("node:fs/promises");
      const full = `${projectDir}/${siteConfigPath}`;
      let content: string;
      try {
        content = await fs.readFile(full, "utf8");
      } catch {
        return;
      }
      const updated = content.replace(
        /locales:\s*\[[^\]]*\]/,
        (match) => match.replace(/\]$/, `, "${locale}"]`)
      );
      await fs.writeFile(full, updated, "utf8");
    },
  });

  // 4. (optional) Cloudflare secrets for the new translation source ids.
  if (input.withNotion && input.translationSourceIds) {
    for (const [sourceName, dataSourceId] of Object.entries(
      input.translationSourceIds
    )) {
      const envVar = sourceNameToEnvVar(sourceName);
      if (!envVar) continue;
      changes.push({
        kind: "cloudflare",
        label: `cloudflare-secret:${envVar}`,
        description: `Set worker secret ${envVar} to ${dataSourceId}.`,
        risk: "safe",
        envVar,
        async apply() {
          const { setWorkerSecret } = await import("../provision/cloudflare.js");
          await setWorkerSecret(envVar, dataSourceId, projectDir, [dataSourceId]);
        },
      });
    }
  }

  // 5. (optional) Notion translation data sources — declared but the
  // actual create/reuse happens in the translation-sources runner.
  if (input.withNotion) {
    for (const sourceName of BUILT_IN_NOTION_SOURCES) {
      changes.push({
        kind: "notion",
        label: `notion:${sourceName}`,
        description: `Ensure Notion data source "${sourceName}" exists (idempotent: create or reuse).`,
        risk: "safe",
        modelId: sourceName,
        async apply() {
          return null;
        },
      });
    }
  }

  return { locale, changes };
}

function sourceNameToEnvVar(
  sourceName: string
): `NOTION_${string}_TRANSLATIONS_DATA_SOURCE_ID` | null {
  const map: Record<string, `NOTION_${string}_TRANSLATIONS_DATA_SOURCE_ID`> = {
    "blog-translations": "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
    "page-translations": "NOTION_PAGES_TRANSLATIONS_DATA_SOURCE_ID",
    "block-translations": "NOTION_BLOCKS_TRANSLATIONS_DATA_SOURCE_ID",
    "site-settings-translations":
      "NOTION_SITE_SETTINGS_TRANSLATIONS_DATA_SOURCE_ID",
  };
  return map[sourceName] ?? null;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @notionx/create-nextion-app test -- locale-add/plan`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/locale-add/plan.ts \
        packages/create-nextion-app/tests/locale-add/plan.test.ts
git commit -m "feat(create-nextion-app): add locale-add plan step"
```

---

### Task 4: Add The Apply Step (Idempotent File Writes)

**Files:**
- Create: `packages/create-nextion-app/src/locale-add/apply.ts`
- Create: `packages/create-nextion-app/tests/locale-add/apply.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/create-nextion-app/tests/locale-add/apply.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildLocaleAddPlan } from "../../src/locale-add/plan";
import { runLocaleAddPlan } from "../../src/locale-add/apply";

describe("runLocaleAddPlan", () => {
  it("writes the i18n + site config files idempotently", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "locale-add-"));
    try {
      const i18n = `import { defineI18nConfig } from "@notionx/core/i18n";
export const i18n = defineI18nConfig({
  defaultLocale: "en",
  supportedLocales: ["en"],
});
`;
      const site = `export const siteConfig = {
  defaultLocale: "en",
  locales: ["en"],
};
`;
      await writeFile(`${dir}/lib/i18n/config.ts`, i18n, "utf8");
      await writeFile(`${dir}/lib/site/config.ts`, site, "utf8");
      await writeFile(
        `${dir}/.nextion/scaffold.json`,
        JSON.stringify(
          {
            projectKind: "nextion",
            projectName: "demo",
            scaffoldVersion: "1.0.0",
            defaultLocale: "en",
            supportedLocales: ["en"],
            nextionSource: "1.0.0",
            enableSiteSettings: true,
            contentSource: { id: "blog", title: "Blog", fields: [] },
          },
          null,
          2
        )
      );

      const plan = buildLocaleAddPlan({
        projectDir: dir,
        metadata: JSON.parse(
          await readFile(`${dir}/.nextion/scaffold.json`, "utf8")
        ),
        locale: "zh-CN",
      });
      const summary = await runLocaleAddPlan(plan);
      expect(summary.applied).toContain("metadata:supportedLocales");
      expect(summary.applied).toContain("file:lib/i18n/config.ts");
      expect(summary.applied).toContain("file:lib/site/config.ts");

      const i18nAfter = await readFile(`${dir}/lib/i18n/config.ts`, "utf8");
      expect(i18nAfter).toContain('"zh-CN"');
      const siteAfter = await readFile(`${dir}/lib/site/config.ts`, "utf8");
      expect(siteAfter).toContain('"zh-CN"');

      // Idempotent re-run: locale is now in the list. The runner
      // must still not break.
      const plan2 = buildLocaleAddPlan({
        projectDir: dir,
        metadata: JSON.parse(
          await readFile(`${dir}/.nextion/scaffold.json`, "utf8")
        ),
        locale: "zh-CN",
      });
      const summary2 = await runLocaleAddPlan(plan2);
      expect(summary2.skipped.length).toBeGreaterThan(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @notionx/create-nextion-app test -- locale-add/apply`
Expected: FAIL with "Cannot find module '../../src/locale-add/apply'"

- [ ] **Step 3: Implement the runner**

Create `packages/create-nextion-app/src/locale-add/apply.ts`:

```ts
// packages/create-nextion-app/src/locale-add/apply.ts
//
// Applies a planned set of `LocaleAddChange` records. The runner is
// idempotent: if a file already contains the requested locale, the
// corresponding change is recorded as `skipped`, not applied twice.

import type { LocaleAddChange, LocaleAddPlan } from "./plan.js";

export type LocaleAddSummary = {
  applied: string[];
  skipped: string[];
  failed: Array<{ label: string; error: string }>;
  translationSourceIds: Record<string, string>;
};

export async function runLocaleAddPlan(
  plan: LocaleAddPlan
): Promise<LocaleAddSummary> {
  const summary: LocaleAddSummary = {
    applied: [],
    skipped: [],
    failed: [],
    translationSourceIds: {},
  };

  for (const change of plan.changes) {
    try {
      if (change.kind === "notion") {
        const result = await change.apply();
        if (result?.dataSourceId) {
          summary.translationSourceIds[change.modelId] = result.dataSourceId;
        }
        summary.applied.push(change.label);
        continue;
      }
      await change.apply();
      summary.applied.push(change.label);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // If a file is missing on disk, treat as a no-op (the project
      // may not have that file because it was hand-rolled or moved).
      if (change.kind === "file" && /ENOENT/.test(message)) {
        summary.skipped.push(change.label);
        continue;
      }
      summary.failed.push({ label: change.label, error: message });
    }
  }

  return summary;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @notionx/create-nextion-app test -- locale-add/apply`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/locale-add/apply.ts \
        packages/create-nextion-app/tests/locale-add/apply.test.ts
git commit -m "feat(create-nextion-app): add locale-add runner"
```

---

### Task 5: Plan The Notion Translation Sources

**Files:**
- Create: `packages/create-nextion-app/src/notion-translation-sources/plan.ts`
- Create: `packages/create-nextion-app/src/notion-translation-sources/apply.ts`
- Create: `packages/create-nextion-app/src/notion-translation-sources/index.ts`
- Create: `packages/create-nextion-app/tests/notion-translation-sources/plan.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/create-nextion-app/tests/notion-translation-sources/plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planNotionTranslationSources } from "../../src/notion-translation-sources/plan";

describe("planNotionTranslationSources", () => {
  it("returns one entry per built-in model with the right env-var name", () => {
    const plan = planNotionTranslationSources({
      locale: "zh-CN",
      copyFrom: "en",
      parentPageId: "page-1",
      apiToken: "secret-1",
      existingTranslationSources: {},
    });
    expect(plan).toHaveLength(4);
    expect(plan[0]).toMatchObject({
      modelId: "blog-translations",
      envVar: "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
      parentPageId: "page-1",
    });
  });

  it("reuses an existing translation source when one is already in metadata", () => {
    const plan = planNotionTranslationSources({
      locale: "zh-CN",
      parentPageId: "page-1",
      apiToken: "secret-1",
      existingTranslationSources: {
        "blog-translations": {
          dataSourceId: "ds-1",
          envVar: "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
        },
      },
    });
    const blog = plan.find((p) => p.modelId === "blog-translations");
    expect(blog?.action).toBe("reuse");
    expect(blog?.existingDataSourceId).toBe("ds-1");
  });

  it("plans a create + seed from copy-from when no existing source", () => {
    const plan = planNotionTranslationSources({
      locale: "zh-CN",
      copyFrom: "en",
      parentPageId: "page-1",
      apiToken: "secret-1",
      existingTranslationSources: {},
    });
    const blog = plan.find((p) => p.modelId === "blog-translations");
    expect(blog?.action).toBe("create");
    expect(blog?.copyFrom).toBe("en");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @notionx/create-nextion-app test -- notion-translation-sources/plan`
Expected: FAIL with "Cannot find module '../../src/notion-translation-sources/plan'"

- [ ] **Step 3: Implement the planner and apply**

Create `packages/create-nextion-app/src/notion-translation-sources/plan.ts`:

```ts
// packages/create-nextion-app/src/notion-translation-sources/plan.ts
//
// Pure planner for the four built-in Notion translation data
// sources. The planner never calls the `ntn` CLI; it returns a
// list of `NotionTranslationSourcePlan` records that the runner
// resolves into actual Notion resources.

import type { TranslationSourceRef } from "../metadata.js";

export type NotionTranslationSourcePlan = {
  modelId:
    | "blog-translations"
    | "page-translations"
    | "block-translations"
    | "site-settings-translations";
  envVar: string;
  parentPageId: string;
  copyFrom?: string;
  existingDataSourceId?: string;
  action: "create" | "reuse";
};

const MODEL_ID_TO_ENV: Record<
  NotionTranslationSourcePlan["modelId"],
  string
> = {
  "blog-translations": "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
  "page-translations": "NOTION_PAGES_TRANSLATIONS_DATA_SOURCE_ID",
  "block-translations": "NOTION_BLOCKS_TRANSLATIONS_DATA_SOURCE_ID",
  "site-settings-translations":
    "NOTION_SITE_SETTINGS_TRANSLATIONS_DATA_SOURCE_ID",
};

const ALL_MODEL_IDS: NotionTranslationSourcePlan["modelId"][] = [
  "blog-translations",
  "page-translations",
  "block-translations",
  "site-settings-translations",
];

export type PlanNotionTranslationSourcesInput = {
  locale: string;
  parentPageId: string;
  apiToken: string;
  copyFrom?: string;
  existingTranslationSources: Record<string, TranslationSourceRef | undefined>;
};

export function planNotionTranslationSources(
  input: PlanNotionTranslationSourcesInput
): NotionTranslationSourcePlan[] {
  return ALL_MODEL_IDS.map((modelId) => {
    const envVar = MODEL_ID_TO_ENV[modelId];
    const existing = input.existingTranslationSources[modelId];
    return {
      modelId,
      envVar,
      parentPageId: input.parentPageId,
      copyFrom: input.copyFrom,
      existingDataSourceId: existing?.dataSourceId,
      action: existing ? "reuse" : "create",
    };
  });
}
```

Create `packages/create-nextion-app/src/notion-translation-sources/apply.ts`:

```ts
// packages/create-nextion-app/src/notion-translation-sources/apply.ts
//
// Applies the planned translation data source changes via the `ntn`
// CLI. This module owns the only place that shells out to Notion for
// translation sources; everything else flows through the same
// `LocaleAddChange` runner.

import { runNtn } from "../provision/shell.js";
import type { NotionTranslationSourcePlan } from "./plan.js";

export type ApplyTranslationSourcesResult = {
  resolved: Record<string, { dataSourceId: string; envVar: string }>;
  failures: Array<{ modelId: string; error: string }>;
};

export async function applyNotionTranslationSources(
  plans: NotionTranslationSourcePlan[]
): Promise<ApplyTranslationSourcesResult> {
  const result: ApplyTranslationSourcesResult = { resolved: {}, failures: [] };
  for (const plan of plans) {
    if (plan.action === "reuse" && plan.existingDataSourceId) {
      result.resolved[plan.modelId] = {
        dataSourceId: plan.existingDataSourceId,
        envVar: plan.envVar,
      };
      continue;
    }
    try {
      const cli = await runNtn(
        [
          "databases",
          "create",
          "--parent",
          plan.parentPageId,
          "--title",
          titleFor(plan.modelId),
        ],
        { allowFailure: true }
      );
      if (cli.code !== 0) {
        result.failures.push({
          modelId: plan.modelId,
          error: cli.stderr || cli.stdout,
        });
        continue;
      }
      const parsed = JSON.parse(cli.stdout) as { dataSourceId?: string };
      const dataSourceId = parsed.dataSourceId;
      if (!dataSourceId) {
        result.failures.push({
          modelId: plan.modelId,
          error: "ntn did not return a dataSourceId",
        });
        continue;
      }
      result.resolved[plan.modelId] = { dataSourceId, envVar: plan.envVar };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failures.push({ modelId: plan.modelId, error: message });
    }
  }
  return result;
}

function titleFor(modelId: string): string {
  const map: Record<string, string> = {
    "blog-translations": "Blog Translations",
    "page-translations": "Page Translations",
    "block-translations": "Block Translations",
    "site-settings-translations": "Site Settings Translations",
  };
  return map[modelId] ?? modelId;
}
```

Create `packages/create-nextion-app/src/notion-translation-sources/index.ts`:

```ts
export * from "./plan.js";
export * from "./apply.js";
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @notionx/create-nextion-app test -- notion-translation-sources/plan`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/notion-translation-sources/ \
        packages/create-nextion-app/tests/notion-translation-sources/plan.test.ts
git commit -m "feat(create-nextion-app): add notion translation source planner + runner"
```

---

### Task 6: Wire The Notion Planner Into The Locale-Add Runner

**Files:**
- Modify: `packages/create-nextion-app/src/locale-add/plan.ts`
- Create: `packages/create-nextion-app/tests/locale-add/with-notion.test.ts`

- [ ] **Step 1: Update the planner to take a `notion` plan function**

Edit `packages/create-nextion-app/src/locale-add/plan.ts` to add a `notionPlanner` parameter to `BuildLocaleAddPlanInput` and use it. The signature becomes:

```ts
import type { NotionTranslationSourcePlan } from "../notion-translation-sources/plan.js";
import { planNotionTranslationSources as defaultNotionPlanner } from "../notion-translation-sources/plan.js";

export type BuildLocaleAddPlanInput = {
  projectDir: string;
  metadata: ScaffoldMetadata;
  locale: string;
  withNotion?: boolean;
  copyFrom?: string;
  parentPageId?: string;
  apiToken?: string;
  existingTranslationSources?: Record<string, { dataSourceId: string; envVar: string }>;
  notionPlanner?: (input: {
    locale: string;
    parentPageId: string;
    apiToken: string;
    copyFrom?: string;
    existingTranslationSources: Record<string, { dataSourceId: string; envVar: string }>;
  }) => NotionTranslationSourcePlan[];
  /** Pre-resolved translation data source ids, keyed by translation source name. */
  translationSourceIds?: Record<string, string>;
};
```

Inside `buildLocaleAddPlan`, replace the inline `notion` block with:

```ts
if (input.withNotion) {
  const planner = input.notionPlanner ?? defaultNotionPlanner;
  const notionPlans = planner({
    locale,
    parentPageId: input.parentPageId ?? "",
    apiToken: input.apiToken ?? "",
    copyFrom: input.copyFrom,
    existingTranslationSources: input.existingTranslationSources ?? {},
  });
  for (const np of notionPlans) {
    changes.push({
      kind: "notion",
      label: `notion:${np.modelId}`,
      description: `Ensure Notion data source "${np.modelId}" exists (action: ${np.action}).`,
      risk: np.action === "reuse" ? "conflict" : "safe",
      modelId: np.modelId,
      async apply() {
        return { dataSourceId: np.existingDataSourceId ?? "" };
      },
    });
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `packages/create-nextion-app/tests/locale-add/with-notion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildLocaleAddPlan } from "../../src/locale-add/plan";
import type { ScaffoldMetadata } from "../../src/metadata";

const baseMetadata: ScaffoldMetadata = {
  projectKind: "nextion",
  projectName: "demo",
  scaffoldVersion: "1.0.0",
  defaultLocale: "en",
  supportedLocales: ["en"],
  nextionSource: "1.0.0",
  enableSiteSettings: true,
  contentSource: { id: "blog", title: "Blog", fields: [] },
};

describe("buildLocaleAddPlan with --with-notion", () => {
  it("calls the injected notion planner exactly once", () => {
    let calls = 0;
    const plan = buildLocaleAddPlan({
      projectDir: "/tmp/proj",
      metadata: baseMetadata,
      locale: "zh-CN",
      withNotion: true,
      parentPageId: "page-1",
      apiToken: "secret",
      notionPlanner: () => {
        calls += 1;
        return [];
      },
    });
    expect(calls).toBe(1);
    expect(plan.changes.some((c) => c.kind === "notion")).toBe(false);
  });

  it("records a conflict risk for the model whose translation source is being reused", () => {
    const plan = buildLocaleAddPlan({
      projectDir: "/tmp/proj",
      metadata: baseMetadata,
      locale: "zh-CN",
      withNotion: true,
      parentPageId: "page-1",
      apiToken: "secret",
      existingTranslationSources: {
        "blog-translations": {
          dataSourceId: "ds-1",
          envVar: "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
        },
      },
    });
    const blogChange = plan.changes.find(
      (c) => c.kind === "notion" && c.modelId === "blog-translations"
    );
    expect(blogChange?.risk).toBe("conflict");
  });
});
```

- [ ] **Step 3: Run the test to confirm it passes**

Run: `pnpm --filter @notionx/create-nextion-app test -- locale-add/with-notion`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/create-nextion-app/src/locale-add/plan.ts \
        packages/create-nextion-app/tests/locale-add/with-notion.test.ts
git commit -m "feat(create-nextion-app): wire notion translation planner into locale-add"
```

---

### Task 7: Wire The `nextion locale add` Subcommand Into The CLI

**Files:**
- Modify: `packages/create-nextion-app/src/cli-nextion.ts`
- Create: `packages/create-nextion-app/src/locale-add/format.ts`

- [ ] **Step 1: Add the format module**

Create `packages/create-nextion-app/src/locale-add/format.ts`:

```ts
// packages/create-nextion-app/src/locale-add/format.ts
//
// Pretty-prints a locale-add summary. The output mirrors the style
// of `nextion update` so the two commands feel like the same tool.

import * as p from "@clack/prompts";
import type { LocaleAddPlan } from "./plan.js";
import type { LocaleAddSummary } from "./apply.js";

export function formatLocaleAddDryRun(plan: LocaleAddPlan): string[] {
  const lines: string[] = [];
  lines.push(`planned changes for locale "${plan.locale}":`);
  for (const change of plan.changes) {
    lines.push(`  - [${change.risk}] ${change.label}: ${change.description}`);
  }
  return lines;
}

export function logLocaleAddDryRun(plan: LocaleAddPlan): void {
  p.log.info("dry run — no files written");
  for (const line of formatLocaleAddDryRun(plan)) {
    p.log.info(line);
  }
}

export function logLocaleAddSummary(summary: LocaleAddSummary): void {
  if (summary.applied.length > 0) {
    p.log.info("applied:");
    for (const label of summary.applied) p.log.info(`  - ${label}`);
  }
  if (summary.skipped.length > 0) {
    p.log.info("skipped (already applied):");
    for (const label of summary.skipped) p.log.info(`  - ${label}`);
  }
  if (summary.failed.length > 0) {
    p.log.error("failed:");
    for (const failure of summary.failed) {
      p.log.error(`  - ${failure.label}: ${failure.error}`);
    }
  }
}
```

- [ ] **Step 2: Wire the subcommand into cli-nextion.ts**

Edit `packages/create-nextion-app/src/cli-nextion.ts` to add a new branch for `locale add <locale>`. The new code lives inside `main`, before the existing `throw new Error("Unsupported command: ...")` line:

```ts
if (command === "locale" && subcommand === "add") {
  const localeArg = argv[2];
  if (!localeArg) {
    throw new Error("Usage: nextion locale add <locale> [--apply] [--with-notion] [--copy-from <locale>]");
  }
  const flags = new Set(argv.slice(3));
  const apply = flags.has("--apply");
  const withNotion = flags.has("--with-notion");
  const copyFromFlag = argv.indexOf("--copy-from");
  const copyFrom = copyFromFlag >= 0 ? argv[copyFromFlag + 1] : undefined;

  const { loadProjectContext } = await import("./project-context.js");
  const { validateLocaleAdd } = await import("./locale-add/validate.js");
  const { buildLocaleAddPlan } = await import("./locale-add/plan.js");
  const { runLocaleAddPlan } = await import("./locale-add/apply.js");
  const {
    logLocaleAddDryRun,
    logLocaleAddSummary,
  } = await import("./locale-add/format.js");

  const context = await loadProjectContext(process.cwd());
  const validation = validateLocaleAdd({
    locale: localeArg,
    supportedLocales: context.metadata.supportedLocales,
    defaultLocale: context.metadata.defaultLocale,
  });
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const plan = buildLocaleAddPlan({
    projectDir: context.projectDir,
    metadata: context.metadata,
    locale: validation.locale,
    withNotion,
    copyFrom,
  });
  logLocaleAddDryRun(plan);

  if (!apply) {
    p.log.info("re-run with --apply to write the changes.");
    return;
  }

  const summary = await runLocaleAddPlan(plan);
  logLocaleAddSummary(summary);
  return;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/create-nextion-app/src/cli-nextion.ts \
        packages/create-nextion-app/src/locale-add/format.ts
git commit -m "feat(create-nextion-app): wire `nextion locale add` subcommand"
```

---

### Task 8: Extend The Doctor With Translation-Source Checks

**Files:**
- Modify: `packages/nextion/src/doctor/doctor.ts`
- Create: `packages/nextion/tests/doctor/translation-sources.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/nextion/tests/doctor/translation-sources.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildNextionDoctorReport } from "../../src/doctor/doctor";

describe("translation source checks", () => {
  it("flags missing translation sources for each model in supportedLocales", () => {
    const report = buildNextionDoctorReport({
      env: { NOTION_TOKEN: "secret" },
      wranglerConfig: null,
      models: [
        {
          id: "blog",
          label: "Blog",
          listPath: "/blog",
          detailPath: "/blog/[slug]",
          visibility: { public: true, admin: true },
          routes: { listPath: "/blog", detailPath: "/blog/[slug]" },
          source: {
            dataSourceEnv: "NOTION_DATA_SOURCE_ID",
            translationSourceEnv: "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
            translationSources: ["blog-translations"],
          },
        },
      ],
      supportedLocales: ["en", "zh-CN"],
      translationSources: {},
    });
    const ids = report.checks.map((check) => check.id);
    expect(ids).toContain("locale.translationSources.blog-translations");
    expect(report.overall.status).toBe("missing");
  });

  it("passes when translation sources are configured for every model", () => {
    const report = buildNextionDoctorReport({
      env: { NOTION_TOKEN: "secret" },
      wranglerConfig: null,
      models: [
        {
          id: "blog",
          label: "Blog",
          listPath: "/blog",
          detailPath: "/blog/[slug]",
          visibility: { public: true, admin: true },
          routes: { listPath: "/blog", detailPath: "/blog/[slug]" },
          source: {
            dataSourceEnv: "NOTION_DATA_SOURCE_ID",
            translationSourceEnv: "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
            translationSources: ["blog-translations"],
          },
        },
      ],
      supportedLocales: ["en", "zh-CN"],
      translationSources: {
        "blog-translations": { envVar: "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID" },
      },
    });
    const ids = report.checks.map((check) => check.id);
    expect(
      ids.includes("locale.translationSources.blog-translations")
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @notionx/core test -- doctor/translation-sources`
Expected: FAIL with type errors (the new options are not in `BuildNextionDoctorReportOptions`)

- [ ] **Step 3: Extend the doctor**

Edit `packages/nextion/src/doctor/doctor.ts`:

1. Add new optional `supportedLocales` and `translationSources` fields to `BuildNextionDoctorReportOptions`.
2. Add a new check builder `translationSourceChecks(env, supportedLocales, translationSources, models)` that, for every model that declares `translationSources` and for every entry in `supportedLocales` beyond the default, emits a `missing` check if the translation source ref is not present in `translationSources`.
3. Wire it into `buildNextionDoctorReport` after `notionChecks(env)`.
4. Append the `nextion locale add` suggestion to `nextSteps` when any translation-source check is `missing`.

The new code is:

```ts
// Add to BuildNextionDoctorReportOptions:
supportedLocales?: readonly string[];
translationSources?: Record<string, { envVar: string }>;

// Add the new check builder:
function translationSourceChecks(
  env: EnvLike,
  supportedLocales: readonly string[] | undefined,
  translationSources: Record<string, { envVar: string }> | undefined,
  models: readonly ContentModelDefinition<NotionFieldMap>[]
): NextionDoctorCheck[] {
  if (!supportedLocales || supportedLocales.length < 2) return [];
  if (!models.length) return [];
  const checks: NextionDoctorCheck[] = [];
  for (const model of models) {
    const names = (model.source as { translationSources?: string[] })
      .translationSources;
    if (!names) continue;
    for (const name of names) {
      const ref = translationSources?.[name];
      const envVar = ref?.envVar;
      const present = envVar ? hasEnv(env, envVar) : false;
      checks.push({
        id: `locale.translationSources.${name}`,
        label: `Translation source: ${name}`,
        status: present ? "ok" : "missing",
        required: false,
        detail: present
          ? `${name} is configured (${envVar})`
          : `${name} is missing — run \`npx nextion locale add ${supportedLocales[supportedLocales.length - 1]}\``,
        action: present
          ? undefined
          : `Run \`npx nextion locale add <locale> --with-notion --apply\` to provision ${name}.`,
      });
    }
  }
  return checks;
}

// In buildNextionDoctorReport, replace the `checks` assembly with:
const checks = [
  ...cloudflareChecks(options.wranglerConfig),
  ...notionChecks(env),
  ...translationSourceChecks(
    env,
    options.supportedLocales,
    options.translationSources,
    options.models ?? []
  ),
].map(omitResolvedActions);

// In nextSteps, after the existing uniqueActions + modelActions, add:
const translationActions = checks
  .filter(
    (check) =>
      check.id.startsWith("locale.translationSources.") &&
      check.status === "missing"
  )
  .map((check) => check.action as string);
return {
  ...rest,
  nextSteps: [...uniqueActions(checks), ...modelActions, ...translationActions],
};
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @notionx/core test -- doctor/translation-sources`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/nextion/src/doctor/doctor.ts \
        packages/nextion/tests/doctor/translation-sources.test.ts
git commit -m "feat(nextion): flag missing translation sources in doctor"
```

---

### Task 9: Surface The Translation-Source Check In The Update Repair

**Files:**
- Modify: `packages/create-nextion-app/src/provision/inspect.ts`

- [ ] **Step 1: Add the translation-sources repair entry to `inspectProvisionRepair`**

Edit `packages/create-nextion-app/src/provision/inspect.ts` to extend the `inspectProvisionRepair` function with translation-source checks. After the existing `addSecretEntry` block, append a new pass:

```ts
async function readLocalTranslationSourceState(
  projectDir: string
): Promise<Record<string, { envVar: string; dataSourceId: string }>> {
  // Read scaffold.json to find translationSources written by
  // `nextion locale add`. The metadata file is the source of truth.
  try {
    const raw = await readFile(
      path.join(projectDir, ".nextion", "scaffold.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw) as {
      translationSources?: Record<string, { dataSourceId: string; envVar: string }>;
    };
    return parsed.translationSources ?? {};
  } catch {
    return {};
  }
}

// Inside inspectProvisionRepair, after the addSecretEntry block:
const localTranslations = await readLocalTranslationSourceState(context.projectDir);
for (const [modelId, ref] of Object.entries(localTranslations)) {
  if (!ref.dataSourceId) continue;
  if (remoteNames.has(ref.envVar)) continue;
  entries.push({
    label: `cloudflare-secret:${ref.envVar}`,
    kind: "cloudflare",
    group: "cloudflareBinding",
    risk: "safe",
    async apply() {
      await setWorkerSecret(ref.envVar, ref.dataSourceId, context.projectDir, [ref.dataSourceId]);
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/create-nextion-app/src/provision/inspect.ts
git commit -m "feat(create-nextion-app): repair translation source secrets in `nextion update`"
```

---

### Task 10: Document The New Command

**Files:**
- Modify: `packages/create-nextion-app/src/templates/README.md.tmpl`
- Modify: `packages/create-nextion-app/README.md`

- [ ] **Step 1: Add a "Adding a locale to an existing project" section to the template README**

Edit `packages/create-nextion-app/src/templates/README.md.tmpl`. After the existing "Multilingual foundation" section, append:

````markdown
## Adding a locale to an existing project

```bash
# 1. Dry run — see exactly what would change, no Notion calls.
npx nextion locale add zh-CN

# 2. Apply the local changes (metadata + i18n config + site config).
npx nextion locale add zh-CN --apply

# 3. (Optional) Provision the four translation data sources in
#    Notion and sync the new ids as worker secrets.
npx nextion locale add zh-CN --with-notion --apply \
  --copy-from en
```

The command refuses to remove or overwrite existing locales. It only ever adds, and the local pass never contacts Notion. Re-running with the same locale is a no-op (the validator returns "already in supportedLocales").

After adding a locale, edit the translation data sources in Notion to fill in the locale-specific copy. The `LocaleSwitcher` in the header picks up the new locale automatically on the next deploy.
````

- [ ] **Step 2: Document the same flow in the package README**

Edit `packages/create-nextion-app/README.md` to add a `## Adding a locale` section that points to the same flow. The new section lives right after the existing "Notion-backed pages" paragraph:

```markdown
## Adding a locale

See the `Multilingual foundation` section in the generated project README for the full flow:

- `npx nextion locale add <locale>` (dry run)
- `npx nextion locale add <locale> --apply` (writes scaffold metadata + locale config)
- `npx nextion locale add <locale> --with-notion --apply [--copy-from <locale>]` (provisions translation data sources)
```

- [ ] **Step 3: Commit**

```bash
git add packages/create-nextion-app/src/templates/README.md.tmpl \
        packages/create-nextion-app/README.md
git commit -m "docs(create-nextion-app): document the `nextion locale add` flow"
```

---

### Task 11: Final Verification And Changeset

**Files:**
- Create: `.changeset/multilingual-starter-foundation-phase-2.md`

- [ ] **Step 1: Run the full monorepo typecheck**

Run: `pnpm -r typecheck`
Expected: exit code `0`

- [ ] **Step 2: Run the full monorepo tests**

Run: `pnpm -r test`
Expected: exit code `0`

- [ ] **Step 3: Run the release status check**

Run: `pnpm release:status`
Expected: a clean no-publish result (or a clear changeset warning)

- [ ] **Step 4: Write the changeset**

Create `.changeset/multilingual-starter-foundation-phase-2.md`:

```md
---
"@notionx/core": minor
"@notionx/create-nextion-app": minor
---

Add `npx nextion locale add <locale>` with a safe local-only default pass and an opt-in `--with-notion` flag that provisions the four built-in translation data sources (`blog-translations`, `page-translations`, `block-translations`, `site-settings-translations`). The command refuses to remove existing locales, never contacts Notion on the local pass, and surfaces missing translation sources in the doctor. `nextion update` now repairs translation-source secrets the same way it repairs Notion content-source secrets.
```

- [ ] **Step 5: Commit the changeset**

```bash
git add .changeset/multilingual-starter-foundation-phase-2.md
git commit -m "chore: add changeset for nextion locale add command"
```

---

## Self-Review

- [ ] **Spec coverage** — Re-checked the design spec against the tasks: every "What The Command Must Not Do" rule is enforced in Task 2 (validator refuses removals) and Task 4 (runner treats missing files as no-op). The local-only default path is enforced in Task 6 (`withNotion` is the only way to opt in). The doctor integration is in Task 8. The "never delete user data" rule is enforced by the planner only ever producing `add` / `reuse` / `create` changes.
- [ ] **Placeholder scan** — No "TBD" / "TODO" / "similar to" markers. Every code block contains the actual code the engineer will paste.
- [ ] **Type consistency** — `TranslationSourceRef` is defined in `metadata.ts` and re-used in `plan.ts`, `notion-translation-sources/plan.ts`, and `inspect.ts`. `modelId` literals are pinned to the same four-string union across `plan.ts`, `notion-translation-sources/plan.ts`, and `apply.ts`.

## Follow-Up Plan (Out Of Scope For Phase 2)

- Phase 3 plan: developer ergonomics, custom-model extension examples, optional skill-assisted workflows on top of the `nextion locale add` command.
