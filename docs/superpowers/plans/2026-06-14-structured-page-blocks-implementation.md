# Structured Page Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `hero`, `feature-grid`, and `story` from generic `NotionBlocks` wrappers into strongly-typed, shadcn/ui-driven structured page block components.

**Architecture:** Keep `Pages` as an ordered list of block references and `Blocks` as the reusable source of truth, but replace generic block-body rendering with typed runtime mapping and per-type React components. The change is split into core page/block typing, scaffold provisioning/schema updates, generated runtime mapping, and final component rendering with compatibility fallbacks.

**Tech Stack:** TypeScript, Vitest, Next.js App Router templates, shadcn/ui, Notion data source provisioning, `@notionx/core`

---

## File Map

- Modify: `packages/nextion/src/pages/types.ts`
  Purpose: Extend the page/runtime block model to support strongly-typed structured block payloads.
- Modify: `packages/nextion/src/pages/source.ts`
  Purpose: Parse page-level block refs and expose normalized structured block metadata.
- Modify: `packages/nextion/src/pages/source.test.ts`
  Purpose: Lock in JSON parsing and normalization behavior for structured block references.
- Modify: `packages/create-nextion-app/src/provision/notion.test.ts`
  Purpose: Add RED coverage for expanded `Blocks` schema and typed seed payloads.
- Modify: `packages/create-nextion-app/src/provision/notion.ts`
  Purpose: Expand block schema, seed typed records, and keep compatibility-safe provisioning behavior.
- Modify: `packages/create-nextion-app/src/render.test.ts`
  Purpose: Lock in generated runtime/component output for typed blocks.
- Modify: `packages/create-nextion-app/src/templates/lib/content/models.ts.tmpl`
  Purpose: Expose the additional type-specific fields in the generated `blocksSource`.
- Modify: `packages/create-nextion-app/src/templates/lib/pages/source.ts.tmpl`
  Purpose: Resolve `blocksSource` rows into typed runtime records and compatibility fallbacks.
- Modify: `packages/create-nextion-app/src/templates/lib/pages/model.ts.tmpl`
  Purpose: Keep the generated `Pages` model aligned with `Blocks` references.
- Modify: `packages/create-nextion-app/src/templates/components/page-blocks.tsx.tmpl`
  Purpose: Turn the current shell renderer into a real typed dispatcher.
- Create: `packages/create-nextion-app/src/templates/components/page-blocks/hero-block.tsx.tmpl`
  Purpose: Render `hero` with shadcn `Badge` and `Button`.
- Create: `packages/create-nextion-app/src/templates/components/page-blocks/feature-grid-block.tsx.tmpl`
  Purpose: Render `feature-grid` with shadcn `Card`.
- Create: `packages/create-nextion-app/src/templates/components/page-blocks/story-block.tsx.tmpl`
  Purpose: Render `story` with fixed layout variants.
- Modify: `packages/create-nextion-app/src/templates/app/page.tsx.tmpl`
  Purpose: Keep homepage preferring structured blocks over generic `NotionBlocks`.
- Modify: `packages/create-nextion-app/src/templates/app/[slug]/page.tsx.tmpl`
  Purpose: Keep inner pages preferring structured blocks over generic `NotionBlocks`.

### Task 1: Core Structured Block Types

**Files:**
- Modify: `packages/nextion/src/pages/types.ts`
- Modify: `packages/nextion/src/pages/source.ts`
- Test: `packages/nextion/src/pages/source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("parses structured block refs from Pages.Blocks JSON", () => {
  const page: NotionPageLike = {
    id: "page-id",
    properties: {
      Name: title("Home"),
      Key: richText("home"),
      Slug: richText(""),
      Status: { type: "select", select: { name: "Published" } },
      Layout: { type: "select", select: { name: "home" } },
      Description: richText("Homepage"),
      "Show in Nav": { type: "checkbox", checkbox: false },
      "Nav Label": richText("Home"),
      "Nav Order": { type: "number", number: 0 },
      "Show in Footer": { type: "checkbox", checkbox: false },
      "Footer Label": richText("Home"),
      "Footer Group": { type: "select", select: { name: "Site" } },
      "Footer Order": { type: "number", number: 0 },
      Blocks: richText(
        JSON.stringify([
          { slug: "home-hero", order: 10 },
          { slug: "home-feature-grid", order: 20 },
        ])
      ),
    },
  };

  const mapped = mapNotionPageToSitePage(page, defaultSitePageFields);

  expect(mapped?.structuredBlocks).toEqual([
    { slug: "home-hero", order: 10 },
    { slug: "home-feature-grid", order: 20 },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/pages/source.test.ts --reporter=verbose`
Expected: FAIL because `structuredBlocks` is missing or empty on the mapped page.

- [ ] **Step 3: Write minimal implementation**

```ts
export type SitePageBlockRef = {
  slug: string;
  order?: number;
};

export type SitePage = {
  // existing fields...
  structuredBlocks: SitePageBlockRef[];
  blocks: NotionBlock[];
};

function parseStructuredBlockRefs(raw: string): SitePageBlockRef[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): SitePageBlockRef | null =>
        item && typeof item === "object" && typeof (item as { slug?: unknown }).slug === "string"
          ? {
              slug: normalizePageSlug((item as { slug: string }).slug),
              order:
                typeof (item as { order?: unknown }).order === "number"
                  ? ((item as { order: number }).order)
                  : undefined,
            }
          : null
      )
      .filter((item): item is SitePageBlockRef => Boolean(item && item.slug));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/pages/source.test.ts --reporter=verbose`
Expected: PASS for the new structured block ref parsing case and PASS for the existing navigation/footer tests.

- [ ] **Step 5: Commit**

```bash
git add packages/nextion/src/pages/types.ts packages/nextion/src/pages/source.ts packages/nextion/src/pages/source.test.ts
git commit -m "feat: add structured page block refs"
```

### Task 2: Blocks Schema And Seed Data

**Files:**
- Modify: `packages/create-nextion-app/src/provision/notion.test.ts`
- Modify: `packages/create-nextion-app/src/provision/notion.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("builds typed block properties for hero, feature-grid, and story", () => {
  const properties = _internal.buildBlocksProperties();

  expect(properties.Type).toEqual({ select: {} });
  expect(properties.Eyebrow).toEqual({ rich_text: {} });
  expect(properties.Headline).toEqual({ rich_text: {} });
  expect(properties.Subheadline).toEqual({ rich_text: {} });
  expect(properties["Primary CTA Label"]).toEqual({ rich_text: {} });
  expect(properties["Primary CTA Href"]).toEqual({ url: {} });
  expect(properties.Items).toEqual({ rich_text: {} });
  expect(properties.Columns).toEqual({ number: {} });
  expect(properties.Body).toEqual({ rich_text: {} });
  expect(properties["Quote Attribution"]).toEqual({ rich_text: {} });
  expect(properties.Layout).toEqual({ select: {} });
});

it("seeds hero blocks from structured fields instead of page body content", () => {
  const [hero] = _internal.sampleBlocks({
    projectName: "Demo",
    contentSourceTitle: "Blog",
    locale: "en",
  });
  const payload = _internal.buildSiteBlockPayload({
    databaseId: "db-id",
    projectName: "Demo",
    block: hero,
  });
  const properties = payload.properties as Record<string, unknown>;

  expect((properties.Type as { select: { name: string } }).select.name).toBe("hero");
  expect((properties.Headline as { rich_text: Array<{ text: { content: string } }> }).rich_text[0].text.content).toBeTruthy();
  expect((properties["Primary CTA Href"] as { url: string }).url).toMatch(/^\//);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/provision/notion.test.ts`
Expected: FAIL because the typed block schema fields do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
function buildBlocksProperties(): NotionPropertyMap {
  return {
    Name: { title: {} },
    Slug: { rich_text: {} },
    Status: { select: {} },
    Type: { select: {} },
    Description: { rich_text: {} },
    "Page Keys": { rich_text: {} },
    Order: { number: {} },
    Cover: { files: {} },
    Eyebrow: { rich_text: {} },
    Headline: { rich_text: {} },
    Subheadline: { rich_text: {} },
    "Primary CTA Label": { rich_text: {} },
    "Primary CTA Href": { url: {} },
    "Secondary CTA Label": { rich_text: {} },
    "Secondary CTA Href": { url: {} },
    Alignment: { select: {} },
    Theme: { select: {} },
    Columns: { number: {} },
    Items: { rich_text: {} },
    Body: { rich_text: {} },
    Quote: { rich_text: {} },
    "Quote Attribution": { rich_text: {} },
    "Media Url": { url: {} },
    Layout: { select: {} },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/provision/notion.test.ts`
Expected: PASS for the new schema/seed tests and PASS for the existing provision tests.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/provision/notion.test.ts packages/create-nextion-app/src/provision/notion.ts
git commit -m "feat: add structured block schema and seed data"
```

### Task 3: Generated Runtime Mapping

**Files:**
- Modify: `packages/create-nextion-app/src/render.test.ts`
- Modify: `packages/create-nextion-app/src/templates/lib/content/models.ts.tmpl`
- Modify: `packages/create-nextion-app/src/templates/lib/pages/source.ts.tmpl`
- Modify: `packages/create-nextion-app/src/templates/lib/pages/model.ts.tmpl`

- [ ] **Step 1: Write the failing test**

```ts
it("renders typed structured block mapping into lib/pages/source.ts", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nextion-typed-blocks-"));
  const outDir = path.join(root, "app");
  const answers = applyDefaults(
    {
      projectName: "typed-blocks-app",
      targetDir: outDir,
      adminEmail: "admin@example.com",
      adminPassword: "Password123",
      yes: true,
    },
    ["node", "cli"]
  );

  await render(answers, templatesDir, outDir);

  const source = await fs.readFile(path.join(outDir, "lib/pages/source.ts"), "utf8");
  expect(source).toContain("type: \"hero\"");
  expect(source).toContain("type: \"feature-grid\"");
  expect(source).toContain("type: \"story\"");
  expect(source).toContain("mapGenericBlockToStructuredBlock");
  expect(source).toContain("fallbackToLegacyNotionBlocks");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/render.test.ts`
Expected: FAIL because the generated runtime still exposes only generic `blocks: NotionBlock[]`.

- [ ] **Step 3: Write minimal implementation**

```ts
type StructuredPageBlock =
  | {
      type: "hero";
      slug: string;
      title: string;
      description: string;
      eyebrow: string;
      headline: string;
      subheadline: string;
      primaryCta: { label: string; href: string } | null;
      secondaryCta: { label: string; href: string } | null;
      alignment: "left" | "center";
      theme: "default" | "muted" | "inverse";
      coverImage: string | null;
      editUrl: string | null;
    }
  | {
      type: "feature-grid";
      slug: string;
      title: string;
      description: string;
      headline: string;
      body: string;
      columns: 2 | 3 | 4;
      items: Array<{ title: string; description: string; icon: string; href?: string }>;
      coverImage: string | null;
      editUrl: string | null;
    }
  | {
      type: "story";
      slug: string;
      title: string;
      description: string;
      headline: string;
      body: string;
      quote: string;
      quoteAttribution: string;
      mediaUrl: string | null;
      layout: "text-left" | "media-left" | "media-right";
      coverImage: string | null;
      editUrl: string | null;
    }
  | {
      type: "legacy";
      slug: string;
      title: string;
      description: string;
      blocks: NotionBlock[];
      coverImage: string | null;
      editUrl: string | null;
    };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/render.test.ts`
Expected: PASS for the new generated-source assertions and PASS for the earlier render tests.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/render.test.ts packages/create-nextion-app/src/templates/lib/content/models.ts.tmpl packages/create-nextion-app/src/templates/lib/pages/source.ts.tmpl packages/create-nextion-app/src/templates/lib/pages/model.ts.tmpl
git commit -m "feat: generate typed structured block runtime"
```

### Task 4: Structured Block Components And Page Rendering

**Files:**
- Modify: `packages/create-nextion-app/src/templates/components/page-blocks.tsx.tmpl`
- Create: `packages/create-nextion-app/src/templates/components/page-blocks/hero-block.tsx.tmpl`
- Create: `packages/create-nextion-app/src/templates/components/page-blocks/feature-grid-block.tsx.tmpl`
- Create: `packages/create-nextion-app/src/templates/components/page-blocks/story-block.tsx.tmpl`
- Modify: `packages/create-nextion-app/src/templates/app/page.tsx.tmpl`
- Modify: `packages/create-nextion-app/src/templates/app/[slug]/page.tsx.tmpl`
- Test: `packages/create-nextion-app/src/render.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("renders dedicated structured block component files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nextion-page-block-components-"));
  const outDir = path.join(root, "app");
  const answers = applyDefaults(
    {
      projectName: "page-block-components-app",
      targetDir: outDir,
      adminEmail: "admin@example.com",
      adminPassword: "Password123",
      yes: true,
    },
    ["node", "cli"]
  );

  await render(answers, templatesDir, outDir);

  const hero = await fs.readFile(
    path.join(outDir, "components/page-blocks/hero-block.tsx"),
    "utf8"
  );
  const featureGrid = await fs.readFile(
    path.join(outDir, "components/page-blocks/feature-grid-block.tsx"),
    "utf8"
  );
  const story = await fs.readFile(
    path.join(outDir, "components/page-blocks/story-block.tsx"),
    "utf8"
  );

  expect(hero).toContain("export function HeroBlock");
  expect(featureGrid).toContain("export function FeatureGridBlock");
  expect(story).toContain("export function StoryBlock");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/render.test.ts`
Expected: FAIL because the generated component files do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
export function HeroBlock({ block }: { block: Extract<StructuredPageBlock, { type: "hero" }> }) {
  return (
    <section className="border-b bg-muted/20">
      <div className="container mx-auto max-w-5xl px-4 py-16 text-center">
        {block.eyebrow ? <Badge variant="outline">{block.eyebrow}</Badge> : null}
        <h2 className="mt-4 text-4xl font-semibold tracking-tight">{block.headline}</h2>
        {block.subheadline ? (
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{block.subheadline}</p>
        ) : null}
        <div className="mt-8 flex items-center justify-center gap-3">
          {block.primaryCta ? <Button asChild><Link href={block.primaryCta.href}>{block.primaryCta.label}</Link></Button> : null}
          {block.secondaryCta ? <Button asChild variant="secondary"><Link href={block.secondaryCta.href}>{block.secondaryCta.label}</Link></Button> : null}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/render.test.ts src/provision/notion.test.ts`
Expected: PASS for the new component-file assertions and PASS for the earlier typed block render/provision tests.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/templates/components/page-blocks.tsx.tmpl packages/create-nextion-app/src/templates/components/page-blocks/hero-block.tsx.tmpl packages/create-nextion-app/src/templates/components/page-blocks/feature-grid-block.tsx.tmpl packages/create-nextion-app/src/templates/components/page-blocks/story-block.tsx.tmpl packages/create-nextion-app/src/templates/app/page.tsx.tmpl packages/create-nextion-app/src/templates/app/[slug]/page.tsx.tmpl packages/create-nextion-app/src/render.test.ts
git commit -m "feat: render structured page blocks with typed components"
```

### Task 5: Final Verification

**Files:**
- Test: `packages/nextion/src/pages/source.test.ts`
- Test: `packages/create-nextion-app/src/provision/notion.test.ts`
- Test: `packages/create-nextion-app/src/render.test.ts`

- [ ] **Step 1: Run the core page parsing tests**

Run: `pnpm exec vitest run src/pages/source.test.ts --reporter=verbose`
Expected: PASS with the structured block ref parsing case green.

- [ ] **Step 2: Run the scaffold provision tests**

Run: `pnpm vitest run src/provision/notion.test.ts`
Expected: PASS with typed block schema and seed assertions green.

- [ ] **Step 3: Run the scaffold render tests**

Run: `pnpm vitest run src/render.test.ts`
Expected: PASS with generated typed-block runtime and component files present.

- [ ] **Step 4: Run diagnostics on touched files**

Run the IDE diagnostics tool for:

```txt
packages/nextion/src/pages/types.ts
packages/nextion/src/pages/source.ts
packages/create-nextion-app/src/provision/notion.ts
packages/create-nextion-app/src/templates/lib/pages/source.ts.tmpl
packages/create-nextion-app/src/templates/components/page-blocks.tsx.tmpl
packages/create-nextion-app/src/templates/components/page-blocks/hero-block.tsx.tmpl
packages/create-nextion-app/src/templates/components/page-blocks/feature-grid-block.tsx.tmpl
packages/create-nextion-app/src/templates/components/page-blocks/story-block.tsx.tmpl
```

Expected: no new TypeScript or template diagnostics.

- [ ] **Step 5: Commit**

```bash
git add packages/nextion/src/pages/source.test.ts packages/create-nextion-app/src/provision/notion.test.ts packages/create-nextion-app/src/render.test.ts
git commit -m "test: verify structured page blocks flow"
```

## Self-Review

- Spec coverage:
  - Structured block schema: covered in Task 2.
  - Typed runtime model and dispatch by `Type`: covered in Task 3.
  - Dedicated shadcn/ui components: covered in Task 4.
  - Compatibility fallback: covered in Tasks 3 and 4.
  - Validation and regression testing: covered in Task 5.
- Placeholder scan:
  - No `TODO`, `TBD`, or "handle appropriately" instructions remain.
- Type consistency:
  - Uses `structuredBlocks`, `buildBlocksProperties()`, `buildSiteBlockPayload()`, `HeroBlock`, `FeatureGridBlock`, and `StoryBlock` consistently across tasks.
