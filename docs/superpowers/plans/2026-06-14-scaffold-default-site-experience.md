# Scaffold Default Site Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a fresh `@notionx/create-nextion-app` install render a coherent default site with semantic homepage naming, three homepage blocks, six visible seeded blog posts, full Site Settings defaults, and stable Home/About/Blog navigation.

**Architecture:** Keep the current Notion-backed `Pages`, `Blocks`, `Site Settings`, and primary content source model, but tighten the seeded defaults so all four sources agree on naming, navigation, and first-run content visibility. The implementation is split into seed/schema corrections in provisioning, generated runtime/template updates for homepage and blog presentation, and Site Settings/default navigation alignment so the generated project no longer mixes conflicting defaults.

**Tech Stack:** TypeScript, Vitest, Next.js App Router templates, Notion provisioning, shadcn/ui, `@notionx/core`

---

## File Map

- Modify: `packages/create-nextion-app/src/provision/notion.ts`
  Purpose: Change seeded pages, blocks, posts, and Site Settings defaults.
- Modify: `packages/create-nextion-app/src/provision/notion.test.ts`
  Purpose: Lock semantic naming, homepage block set, post count, and seeded Site Settings defaults.
- Modify: `packages/create-nextion-app/src/render.test.ts`
  Purpose: Lock generated homepage/blog/template output for the new default site experience.
- Modify: `packages/create-nextion-app/src/templates/lib/pages/source.ts.tmpl`
  Purpose: Update fallback pages/blocks, add homepage latest-posts runtime type, and align semantic names.
- Modify: `packages/create-nextion-app/src/templates/components/page-blocks.tsx.tmpl`
  Purpose: Dispatch the new homepage latest-posts block type.
- Create: `packages/create-nextion-app/src/templates/components/page-blocks/latest-posts-block.tsx.tmpl`
  Purpose: Render the homepage latest-posts block through reusable post cards.
- Modify: `packages/create-nextion-app/src/templates/app/page.tsx.tmpl`
  Purpose: Remove the extra hard-coded homepage marketing section and leave the homepage content to structured blocks.
- Modify: `packages/create-nextion-app/src/templates/app/{{contentSourceListPath}}/page.tsx.tmpl`
  Purpose: Render the blog index as a responsive card grid and keep a real empty state only for true zero-post cases.
- Create: `packages/create-nextion-app/src/templates/components/content/post-card.tsx.tmpl`
  Purpose: Share the same post card UI between the homepage latest-posts block and the blog index.
- Modify: `packages/create-nextion-app/src/templates/lib/site/config.ts.tmpl`
- Modify: `packages/create-nextion-app/src/templates/lib/site/settings.ts.tmpl`
  Purpose: Align fallback navigation and Site Settings precedence with seeded Home/About/Blog defaults and seeded icon/image values.

### Task 1: Lock The Seeded Default Site Contract

**Files:**
- Modify: `packages/create-nextion-app/src/provision/notion.test.ts`
- Modify: `packages/create-nextion-app/src/provision/notion.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests to `packages/create-nextion-app/src/provision/notion.test.ts`:

```ts
it("seeds a semantic homepage and three homepage blocks", () => {
  const pages = _internal.sampleSitePages({
    projectName: "newpj",
    contentSourceId: "blog",
    contentSourceTitle: "Blog",
    contentSourceListPath: "/blog",
    locale: "en",
  });
  const blocks = _internal.sampleBlocks({
    projectName: "newpj",
    contentSourceTitle: "Blog",
    locale: "en",
  });

  expect(pages.find((page) => page.key === "home")?.title).toBe("Home");
  expect(blocks.map((block) => block.title)).toEqual([
    "Homepage Hero",
    "Homepage Feature Grid",
    "Homepage Latest Posts",
  ]);
  expect(blocks.map((block) => block.slug)).not.toContain("about-story");
});

it("seeds six published blog posts by default", () => {
  const posts = _internal.samplePosts("en");

  expect(posts).toHaveLength(6);
  expect(posts.every((post) => Boolean(post.slug))).toBe(true);
});

it("seeds site settings with nav, footer, and icon defaults", () => {
  const payload = _internal.buildSiteSettingsSeedPayload({
    databaseId: "site-settings-db",
    projectName: "newpj",
    defaultLocale: "en",
    contentSourceLabel: "Blog",
    contentSourceHref: "/blog",
  });
  const properties = payload.properties as Record<string, unknown>;
  const nav = properties.Nav as { rich_text: Array<{ text: { content: string } }> };
  const socialImage = properties["Social Image"] as { url: string | null };

  expect(nav.rich_text[0]?.text.content).toContain('"label":"Home"');
  expect(nav.rich_text[0]?.text.content).toContain('"label":"About"');
  expect(nav.rich_text[0]?.text.content).toContain('"label":"Blog"');
  expect(socialImage.url).toContain("picsum.photos");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/notion.test.ts
```

Expected:

```text
FAIL because the current seeds still use project-name-derived homepage labels,
seed only two homepage blocks, still include About Story, seed only three posts,
and Site Settings defaults are sparse.
```

- [ ] **Step 3: Write the minimal provisioning changes**

Update `packages/create-nextion-app/src/provision/notion.ts` with this shape:

```ts
const ENGLISH_SAMPLE_POSTS: SamplePost[] = [
  /* keep the existing 3 */
  {
    title: "Turning Starter Content Into a Real Launch Site",
    slug: "turning-starter-content-into-a-real-launch-site",
    description: "How to take the generated defaults and turn them into a credible launch site.",
    date: "2026-06-08",
    tags: ["Launch", "Starter", "Design"],
    coverSeed: "launch-site",
    intro: "A scaffold is most useful when it already looks believable.",
    sections: [],
    closing: "Replace this with your own launch story.",
  },
  {
    title: "Designing With Reusable Homepage Blocks",
    slug: "designing-with-reusable-homepage-blocks",
    description: "Why the homepage should be assembled from named reusable sections.",
    date: "2026-06-10",
    tags: ["Blocks", "Homepage", "UI"],
    coverSeed: "homepage-blocks",
    intro: "Reusable homepage sections are easier to reason about than ad-hoc route copy.",
    sections: [],
    closing: "Treat the homepage as a composition problem, not a special case.",
  },
  {
    title: "Making Site Settings Useful On Day One",
    slug: "making-site-settings-useful-on-day-one",
    description: "Why navigation, SEO, and icon defaults should be visible immediately.",
    date: "2026-06-12",
    tags: ["Settings", "SEO", "Navigation"],
    coverSeed: "site-settings-day-one",
    intro: "Site settings should be editable from the first install, not after manual cleanup.",
    sections: [],
    closing: "Good defaults are the shortest path to trust.",
  },
];

const homePage = {
  title: "Home",
  key: "home",
  blocks: [
    { slug: "home-hero", variant: "hero", order: 10 },
    { slug: "home-feature-grid", variant: "feature-grid", order: 20 },
    { slug: "home-latest-posts", order: 30 },
  ],
};

const homepageHero = {
  title: "Homepage Hero",
  slug: "home-hero",
};

const homepageLatestPosts = {
  title: "Homepage Latest Posts",
  slug: "home-latest-posts",
  type: "latest-posts",
};
```

Also add a Site Settings seed helper that writes:

```ts
const defaultNav = JSON.stringify([
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: input.contentSourceLabel, href: input.contentSourceHref },
]);

const defaultFooterColumns = JSON.stringify([
  { label: "Company", items: [{ label: "Home", href: "/" }, { label: "About", href: "/about" }] },
  { label: "Content", items: [{ label: input.contentSourceLabel, href: input.contentSourceHref }] },
  { label: "Legal", items: [{ label: "Privacy", href: "/privacy" }] },
]);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/notion.test.ts
```

Expected:

```text
PASS for the new homepage naming, homepage block set, six-post seed, and Site Settings seed assertions.
```

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/provision/notion.ts packages/create-nextion-app/src/provision/notion.test.ts
git commit -m "feat: seed a richer default site experience"
```

### Task 2: Replace The Homepage Hybrid With Three Structured Blocks

**Files:**
- Modify: `packages/create-nextion-app/src/render.test.ts`
- Modify: `packages/create-nextion-app/src/templates/lib/pages/source.ts.tmpl`
- Modify: `packages/create-nextion-app/src/templates/components/page-blocks.tsx.tmpl`
- Create: `packages/create-nextion-app/src/templates/components/page-blocks/latest-posts-block.tsx.tmpl`
- Modify: `packages/create-nextion-app/src/templates/app/page.tsx.tmpl`

- [ ] **Step 1: Write the failing tests**

Add these tests to `packages/create-nextion-app/src/render.test.ts`:

```ts
it("renders three homepage fallback structured blocks with semantic names", async () => {
  const source = await fs.readFile(path.join(outDir, "lib/pages/source.ts"), "utf8");

  expect(source).toContain('title: "Homepage Hero"');
  expect(source).toContain('title: "Homepage Feature Grid"');
  expect(source).toContain('title: "Homepage Latest Posts"');
  expect(source).toContain('{ slug: "home-latest-posts", order: 30 }');
  expect(source).not.toContain('title: "About Story"');
});

it("renders a latest-posts page block component and removes the extra homepage hero copy", async () => {
  const home = await fs.readFile(path.join(outDir, "app/page.tsx"), "utf8");
  const pageBlocks = await fs.readFile(path.join(outDir, "components/page-blocks.tsx"), "utf8");
  const latestPosts = await fs.readFile(
    path.join(outDir, "components/page-blocks/latest-posts-block.tsx"),
    "utf8"
  );

  expect(pageBlocks).toContain("LatestPostsBlock");
  expect(latestPosts).toContain("export function LatestPostsBlock");
  expect(home).not.toContain("Notion Pages + Cloudflare Workers");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/render.test.ts
```

Expected:

```text
FAIL because the generated homepage still has only two fallback blocks, still contains About Story, and `app/page.tsx` still renders the extra hard-coded top section.
```

- [ ] **Step 3: Write the minimal template/runtime implementation**

Update `packages/create-nextion-app/src/templates/lib/pages/source.ts.tmpl` with a new typed block:

```ts
export type StructuredLatestPostsBlock = {
  type: "latest-posts";
  slug: string;
  title: string;
  description: string;
  headline: string;
  body: string;
  count: number;
  primaryCta: BlockCta | null;
};

type StructuredPageBlock =
  | StructuredHeroBlock
  | StructuredFeatureGridBlock
  | StructuredLatestPostsBlock
  | LegacyStructuredPageBlock;
```

Create `packages/create-nextion-app/src/templates/components/page-blocks/latest-posts-block.tsx.tmpl`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/content/post-card";
import { listPublishedContent } from "@/lib/content/source";
import type { StructuredLatestPostsBlock } from "@/lib/pages/source";

export async function LatestPostsBlock({ block }: { block: StructuredLatestPostsBlock }) {
  const posts = await listPublishedContent({ limit: block.count });

  return (
    <section className="border-t bg-background">
      <div className="container mx-auto max-w-6xl px-4 py-14">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{block.headline}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{block.body}</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => <PostCard key={post.slug} item={post} />)}
        </div>
        {block.primaryCta ? (
          <div className="mt-10 flex justify-center">
            <Button asChild size="lg">
              <Link href={block.primaryCta.href}>{block.primaryCta.label}</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
```

Reduce `packages/create-nextion-app/src/templates/app/page.tsx.tmpl` to:

```tsx
export default async function Home() {
  const page = await getSitePageByKey("home");

  return (
    <SiteShell showHeader={page?.showHeader ?? true} showFooter={page?.showFooter ?? true}>
      <main>
        {page?.structuredBlocks?.length ? <PageBlocks blocks={page.structuredBlocks} /> : null}
      </main>
    </SiteShell>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/render.test.ts
```

Expected:

```text
PASS for the new homepage fallback block names, three-block homepage structure, and latest-posts component generation.
```

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/render.test.ts \
  packages/create-nextion-app/src/templates/lib/pages/source.ts.tmpl \
  packages/create-nextion-app/src/templates/components/page-blocks.tsx.tmpl \
  packages/create-nextion-app/src/templates/components/page-blocks/latest-posts-block.tsx.tmpl \
  packages/create-nextion-app/src/templates/app/page.tsx.tmpl
git commit -m "feat: move homepage defaults into structured blocks"
```

### Task 3: Make Blog Content Visible And Rendered As Cards

**Files:**
- Modify: `packages/create-nextion-app/src/render.test.ts`
- Modify: `packages/create-nextion-app/src/templates/app/{{contentSourceListPath}}/page.tsx.tmpl`
- Create: `packages/create-nextion-app/src/templates/components/content/post-card.tsx.tmpl`

- [ ] **Step 1: Write the failing tests**

Add these tests to `packages/create-nextion-app/src/render.test.ts`:

```ts
it("renders the blog index as a card grid", async () => {
  const blogIndex = await fs.readFile(
    path.join(outDir, "app/{{contentSourceListPath}}/page.tsx".replace("{{contentSourceListPath}}", "blog")),
    "utf8"
  );

  expect(blogIndex).toContain('grid gap-6 md:grid-cols-2 xl:grid-cols-3');
  expect(blogIndex).toContain("PostCard");
});

it("keeps the empty-state copy only for the true empty case", async () => {
  const blogIndex = await fs.readFile(
    path.join(outDir, "app/{{contentSourceListPath}}/page.tsx".replace("{{contentSourceListPath}}", "blog")),
    "utf8"
  );

  expect(blogIndex).toContain('if (!items.length)');
  expect(blogIndex).toContain("No blog posts published yet.");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/render.test.ts
```

Expected:

```text
FAIL because the generated blog index still uses a simple vertical list and does not import a shared `PostCard`.
```

- [ ] **Step 3: Write the minimal implementation**

Create `packages/create-nextion-app/src/templates/components/content/post-card.tsx.tmpl`:

```tsx
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PostCard({ item }: { item: { slug: string; title: string; description: string; date: string; tags: string[]; coverImage: string | null } }) {
  return (
    <Link href={`{{contentSourceListPath}}/${item.slug}`} className="block">
      <Card className="h-full overflow-hidden">
        {item.coverImage ? <img src={item.coverImage} alt={item.title} className="h-48 w-full object-cover" /> : null}
        <CardHeader>
          <CardTitle className="line-clamp-2">{item.title}</CardTitle>
          <CardDescription className="line-clamp-3">{item.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{item.date}</span>
          <span>{item.tags[0] ?? ""}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
```

Change `packages/create-nextion-app/src/templates/app/{{contentSourceListPath}}/page.tsx.tmpl` list body to:

```tsx
{!items.length ? (
  <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
    No blog posts published yet.
    <br />
    在 Notion 中把 <code>Published</code> 勾选后，会自动出现在这里。
  </div>
) : (
  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
    {items.map((item) => (
      <PostCard key={item.slug} item={item} />
    ))}
  </div>
)}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/render.test.ts
```

Expected:

```text
PASS for the blog index grid/card assertions while preserving the true empty-state branch.
```

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/render.test.ts \
  packages/create-nextion-app/src/templates/app/{{contentSourceListPath}}/page.tsx.tmpl \
  packages/create-nextion-app/src/templates/components/content/post-card.tsx.tmpl
git commit -m "feat: render blog defaults as a card grid"
```

### Task 4: Align Site Settings And Navigation Defaults

**Files:**
- Modify: `packages/create-nextion-app/src/render.test.ts`
- Modify: `packages/create-nextion-app/src/templates/lib/site/config.ts.tmpl`
- Modify: `packages/create-nextion-app/src/templates/lib/site/settings.ts.tmpl`

- [ ] **Step 1: Write the failing tests**

Add these tests to `packages/create-nextion-app/src/render.test.ts`:

```ts
it("renders fallback navigation with home, about, and blog", async () => {
  const siteConfig = await fs.readFile(path.join(outDir, "lib/site/config.ts"), "utf8");

  expect(siteConfig).toContain('label: "Home"');
  expect(siteConfig).toContain('href: "/"');
  expect(siteConfig).toContain('label: "About"');
  expect(siteConfig).toContain('href: "/about"');
  expect(siteConfig).toContain('label: "Blog"');
});

it("reads seeded Site Settings navigation and image defaults", async () => {
  const settings = await fs.readFile(path.join(outDir, "lib/site/settings.ts"), "utf8");

  expect(settings).toContain('readJson<RawNavItem[]>(extra, "Nav", [])');
  expect(settings).toContain('readUrl(extra, "Social Image")');
  expect(settings).toContain("fallbackSiteConfig.navigation.main");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/render.test.ts
```

Expected:

```text
FAIL because the current fallback site navigation only includes the blog route and the generated defaults are not aligned with Home/About/Blog.
```

- [ ] **Step 3: Write the minimal implementation**

Update `packages/create-nextion-app/src/templates/lib/site/config.ts.tmpl` to:

```ts
navigation: {
  main: [
    { label: "Home", href: "/", modelId: "home" },
    { label: "About", href: "/about", modelId: "about" },
    { label: "{{contentSourceNavLabel}}", href: "{{contentSourceListPath}}", modelId: "{{contentSourceId}}" },
  ],
  cta: null,
  adminHref: "/login",
},
```

Keep `packages/create-nextion-app/src/templates/lib/site/settings.ts.tmpl` precedence as:

```ts
navigation: {
  ...fallbackSiteConfig.navigation,
  main: raw.navigation?.main?.length
    ? raw.navigation.main
    : fallbackSiteConfig.navigation.main,
  cta: raw.navigation?.cta ?? fallbackSiteConfig.navigation.cta,
},
```

Then make sure the seeded Site Settings payload from Task 1 matches the same
Home/About/Blog structure so runtime and fallback defaults agree.

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/render.test.ts
pnpm --filter @notionx/create-nextion-app exec tsc --noEmit
```

Expected:

```text
PASS for navigation/site-settings template tests.
PASS for package typecheck.
```

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/render.test.ts \
  packages/create-nextion-app/src/templates/lib/site/config.ts.tmpl \
  packages/create-nextion-app/src/templates/lib/site/settings.ts.tmpl
git commit -m "feat: align starter navigation and site settings"
```

## Self-Review

- Spec coverage:
  - semantic homepage naming: Task 1, Task 2
  - three homepage blocks: Task 1, Task 2
  - remove `About Story`: Task 1, Task 2
  - six blog posts: Task 1
  - blog card grid: Task 3
  - visible published posts on first run: Task 1, Task 3
  - full Site Settings seed: Task 1, Task 4
  - Home/About/Blog navigation: Task 1, Task 4
- Placeholder scan:
  - No `TBD`, `TODO`, or “similar to previous task” shortcuts remain.
- Type consistency:
  - `latest-posts` is used consistently as the new homepage block type across the file map and task steps.
