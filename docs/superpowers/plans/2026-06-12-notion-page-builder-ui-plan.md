# Notion Page Builder UI Plan

**Goal:** Turn the generated vinext app from a lightweight Notion-backed blog starter into a Notion page builder that uses Notion blocks as the editable content model and Tailwind CSS + shadcn/ui + React as the rendering system.

**Decision:** Do not copy every shadcn/ui component into every scaffolded project. Instead, introduce UI presets and make the `site` preset the recommended target for Notion-driven pages.

**Recommended Default:** `site` once the page-builder renderer lands. Keep `minimal` available for lean blogs and demos.

---

## Context

The current scaffold already has the right foundation:

- `packages/nextion/src/notion/blocks.ts` can recursively fetch Notion page blocks.
- `packages/create-nextion-app/src/templates/components/notion-blocks.tsx.tmpl` renders a lightweight article-oriented subset of blocks.
- `components.json` is already configured for shadcn/ui.
- The template ships with a small set of primitives: `Button`, `Card`, `Input`, `Label`, `Badge`, `Separator`, and `Skeleton`.

That is enough for blog pages, but not enough for richer Notion page building. Notion now supports page structures that are closer to layout and product content: columns, toggles, tables, callouts, synced blocks, buttons, embeds, child pages, and database-like content areas. vinext should use these as authoring semantics, then render them through a stronger site design system.

The desired mental model is:

```txt
Notion is the editor.
Tailwind CSS is the visual language.
shadcn/ui is the component foundation.
React is the rendering interpreter.
```

vinext should not make public sites look like Notion. It should let Notion express structure while vinext controls visual quality, responsiveness, accessibility, and brand feel.

## Goals

- Use Notion page blocks as the primary page-building source.
- Add a reusable React block-renderer registry instead of a single monolithic renderer.
- Expand shadcn/ui coverage through presets rather than an all-components default.
- Support richer Notion blocks: columns, tables, toggles, callouts, media, embeds, child pages, synced blocks, and link/button-like CTAs.
- Add a convention for custom React components triggered from Notion content.
- Keep scaffolded projects understandable and maintainable.
- Preserve a small-footprint path for simple blogs.

## Non-Goals

- Do not build a Notion clone.
- Do not depend on Notion's visual styling as the public website design.
- Do not import every shadcn/ui component by default.
- Do not require users to learn a separate CMS DSL for normal pages.
- Do not make the scaffold invoke remote shadcn registries during generation unless the user explicitly asks for it.
- Do not solve complex drag-and-drop visual editing in this phase.

## Product Position

The page-building stack should have three layers:

1. **Native Notion Blocks**
   - The default authoring format.
   - Best for prose, images, lists, FAQ, layout columns, callouts, tables, embeds, and reusable sections.

2. **Enhanced Block Rendering**
   - React components map Notion semantics to polished web UI.
   - Example: Notion `toggle` becomes shadcn `Accordion`; Notion `callout` becomes shadcn `Alert` or a feature item; Notion `table` becomes shadcn `Table`.

3. **Custom Component Blocks**
   - Used only when native blocks cannot represent the desired experience.
   - Example: hero sections, pricing tables, content lists, contact forms, testimonial grids, and product-specific widgets.

## UI Presets

### `minimal`

Purpose: lean blog, simple content site, quick demos.

Components:

- `button`
- `card`
- `input`
- `label`
- `badge`
- `separator`
- `skeleton`

Current scaffold is already close to this preset.

### `site`

Purpose: Notion page builder, public websites, docs, landing-style pages.

Recommended components:

- `accordion` - Notion toggles, FAQ sections.
- `alert` - Notion callouts, warnings, notes, highlight boxes.
- `table` - Notion tables and comparison blocks.
- `aspect-ratio` - images, videos, embeds, media cards.
- `tabs` - custom tabs blocks and compact content switching.
- `tooltip` - icon buttons and subtle inline affordances.
- `dropdown-menu` - navigation and contextual menus.
- `sheet` - mobile nav and side panels.
- `dialog` - modal details, confirmations, gated content prompts.

Keep existing `minimal` primitives included in this preset.

### `app`

Purpose: admin surfaces, dashboards, forms, authenticated apps.

Additional recommended components:

- `select`
- `textarea`
- `checkbox`
- `switch`
- `radio-group`
- `avatar`
- `sonner`
- `form`
- `popover`
- `command`
- `navigation-menu`

Optional, not default:

- `calendar`
- `chart`
- `carousel`
- `drawer`
- `input-otp`
- `resizable`

These should be added by explicit user choice because they increase dependency and maintenance surface.

## Why Not All shadcn/ui Components

shadcn/ui copies source files into the project. All-including components would make every generated app heavier in ways users can see and maintainers must support:

- More files in every new project.
- More Radix dependencies.
- More upgrade drift when shadcn component implementations change.
- Larger accessibility and interaction testing surface.
- More cognitive load for users reading the scaffold.
- Components like `calendar`, `chart`, `carousel`, `input-otp`, and `resizable` are not core to a Notion page renderer.

The better completeness story is not component count. It is:

```txt
Notion block coverage
+ strong renderer architecture
+ focused shadcn component presets
+ stable theme tokens
+ custom component escape hatch
```

## Scaffold UX

Add a UI preset option to `create-nextion-app`:

```bash
pnpm create nextion-app my-site --ui minimal
pnpm create nextion-app my-site --ui site
pnpm create nextion-app my-site --ui app
```

Interactive prompt:

```txt
UI preset?
- Site Builder (recommended)
- Minimal
- App Dashboard
```

Suggested migration path:

1. First release: add `--ui` and keep current default as `minimal` for compatibility.
2. After the expanded Notion renderer lands: make `site` the default for new projects.
3. Keep `minimal` documented as the escape hatch for small blogs.

## Renderer Architecture

Replace the current single-file renderer with a small block-rendering system.

Recommended generated structure:

```txt
components/notion/
  notion-blocks.tsx
  rich-text.tsx
  block-registry.tsx
  block-groups.ts
  custom-components.tsx
  renderers/
    prose.tsx
    lists.tsx
    media.tsx
    layout.tsx
    interactive.tsx
    collections.tsx
```

Core idea:

```ts
type BlockRenderer = (props: {
  block: NotionBlock;
  children?: React.ReactNode;
  context: BlockRenderContext;
}) => React.ReactNode;

type BlockRendererRegistry = Record<string, BlockRenderer>;
```

Rendering flow:

```txt
raw Notion blocks
  -> normalize/group blocks
  -> detect custom component blocks
  -> render with registry
  -> fall back safely for unsupported blocks
```

Important renderer improvements:

- Group adjacent `bulleted_list_item` blocks into one `<ul>`.
- Group adjacent `numbered_list_item` blocks into one `<ol>`.
- Render recursive children consistently.
- Support Notion colors and background colors through theme-aware classes.
- Keep unsupported blocks visible in development but quiet in production.
- Keep media URLs stable through the existing Notion media route where possible.

## Notion Block Mapping

| Notion block | vinext rendering |
| --- | --- |
| `paragraph` | Prose paragraph with rich text rendering |
| `heading_1` | Section heading, not page H1 by default |
| `heading_2` | Subsection heading |
| `heading_3` | Compact heading |
| `bulleted_list_item` | Grouped unordered list |
| `numbered_list_item` | Grouped ordered list |
| `to_do` | Checkbox-style task item or static checklist |
| `toggle` | shadcn `Accordion` |
| `quote` | Blockquote / testimonial variant |
| `callout` | shadcn `Alert`, feature item, note, or CTA variant |
| `divider` | shadcn `Separator` / section divider |
| `image` | Figure + optional shadcn `AspectRatio` |
| `video` | Responsive video frame |
| `embed` | Responsive embed frame or link card fallback |
| `bookmark` | shadcn `Card` link preview |
| `file` | Download card |
| `pdf` | Download card or embedded viewer when safe |
| `audio` | Audio player |
| `code` | Syntax block or custom component config if marked |
| `table` | shadcn `Table` |
| `column_list` | Responsive Tailwind grid |
| `column` | Grid child container |
| `child_page` | Page link card |
| `child_database` | Collection placeholder or configured content list |
| `synced_block` | Render children when available, otherwise reference fallback |
| `button` | Probe API shape; support only safe public-link semantics first |

## Custom Component Convention

Native blocks should cover normal pages. Custom blocks should exist for high-impact sections that need product-quality layout or behavior.

Use a parseable code block as the stable v1 convention:

````md
```vinext
{
  "component": "hero",
  "variant": "split",
  "eyebrow": "Notion-powered publishing",
  "primaryAction": {
    "label": "Start building",
    "href": "/register"
  }
}
```
````

Supported initial components:

- `hero`
- `cta`
- `feature-grid`
- `pricing`
- `faq`
- `content-list`
- `testimonial-grid`
- `contact-form`

Optional author-friendly shorthand can be added later through callouts:

```txt
component: cta
```

The code-block JSON convention should come first because it is explicit, diffable, and easy to validate.

## Page Layout Properties

Add optional page-level fields for site pages:

- `Layout`: `prose`, `wide`, `landing`, `docs`, `blank`
- `Theme`: optional style preset, such as `default`, `editorial`, `product`, `docs`
- `Show Header`: checkbox
- `Show Footer`: checkbox

Rendering meaning:

- `prose` - current article-like max width.
- `wide` - wider content container for mixed content.
- `landing` - section-based page with full-width bands.
- `docs` - documentation layout, optionally with table of contents.
- `blank` - no shell chrome, useful for embedded pages or experiments.

## Implementation Plan

### Phase 1: Define UI Presets

Files likely to modify:

- `packages/create-nextion-app/src/answers.ts`
- `packages/create-nextion-app/src/prompt.ts`
- `packages/create-nextion-app/src/render.ts`
- `packages/create-nextion-app/src/templates/package.json.tmpl`
- `packages/create-nextion-app/src/templates/README.md.tmpl`

Tasks:

- [ ] Add `UiPreset = "minimal" | "site" | "app"` to scaffold answers.
- [ ] Add `--ui <preset>` CLI parsing and help text.
- [ ] Add an interactive preset selector.
- [ ] Render dependencies based on selected preset.
- [ ] Document presets in the generated README.
- [ ] Add tests for CLI parsing and template rendering.

### Phase 2: Vendor Focused shadcn Components

Files likely to create:

- `packages/create-nextion-app/src/templates/components/ui/accordion.tsx.tmpl`
- `packages/create-nextion-app/src/templates/components/ui/alert.tsx.tmpl`
- `packages/create-nextion-app/src/templates/components/ui/table.tsx.tmpl`
- `packages/create-nextion-app/src/templates/components/ui/aspect-ratio.tsx.tmpl`
- `packages/create-nextion-app/src/templates/components/ui/tabs.tsx.tmpl`
- `packages/create-nextion-app/src/templates/components/ui/tooltip.tsx.tmpl`
- `packages/create-nextion-app/src/templates/components/ui/dropdown-menu.tsx.tmpl`
- `packages/create-nextion-app/src/templates/components/ui/sheet.tsx.tmpl`
- `packages/create-nextion-app/src/templates/components/ui/dialog.tsx.tmpl`

Tasks:

- [ ] Add site preset component templates.
- [ ] Add app preset component templates in a separate commit.
- [ ] Keep component code aligned with the configured shadcn `new-york` style.
- [ ] Add a maintainer-only script or doc note for refreshing templates from shadcn.
- [ ] Do not invoke remote registries during normal scaffold generation.

### Phase 3: Split the Notion Renderer

Files likely to modify or create:

- `packages/create-nextion-app/src/templates/components/notion-blocks.tsx.tmpl`
- `packages/create-nextion-app/src/templates/components/notion/*.tsx.tmpl`
- `packages/create-nextion-app/src/templates/components/notion/renderers/*.tsx.tmpl`

Tasks:

- [ ] Extract rich text rendering.
- [ ] Add a block registry.
- [ ] Add block grouping for adjacent list items.
- [ ] Add layout renderers for `column_list` and `column`.
- [ ] Add media renderers for image, video, audio, file, PDF, embed, bookmark.
- [ ] Add interactive renderers for toggle, callout, table, child page.
- [ ] Add development fallback output for unsupported blocks.

### Phase 4: Add Custom Component Blocks

Files likely to create:

- `packages/create-nextion-app/src/templates/components/notion/custom-components.tsx.tmpl`
- `packages/create-nextion-app/src/templates/components/site/sections/*.tsx.tmpl`

Tasks:

- [ ] Parse `code` blocks with language `vinext` as JSON config.
- [ ] Validate config shape before rendering.
- [ ] Add initial components: `hero`, `cta`, `feature-grid`, `faq`, `content-list`.
- [ ] Provide safe fallback for invalid config.
- [ ] Document examples in the generated README.

### Phase 5: Add Page Layout Support

Files likely to modify:

- `packages/create-nextion-app/src/templates/lib/pages/model.ts.tmpl`
- `packages/create-nextion-app/src/templates/lib/pages/source.ts.tmpl`
- `packages/create-nextion-app/src/templates/app/[slug]/page.tsx.tmpl`
- `packages/create-nextion-app/src/provision/notion.ts`

Tasks:

- [ ] Add optional page fields: `Layout`, `Theme`, `Show Header`, `Show Footer`.
- [ ] Map layout values into page detail data.
- [ ] Render shell/container differently by layout.
- [ ] Seed example pages that demonstrate `prose`, `wide`, and `landing`.

### Phase 6: Validate Generated Projects

Tasks:

- [ ] Generate a project with `--ui minimal` and verify current behavior remains lean.
- [ ] Generate a project with `--ui site` and verify all page-builder components compile.
- [ ] Generate a project with `--ui app` and verify admin/form components compile.
- [ ] Run `pnpm test`, `pnpm typecheck`, and `pnpm build` in generated projects.
- [ ] Render sample Notion pages with columns, toggles, callouts, tables, media, and custom component code blocks.
- [ ] Visually inspect desktop and mobile layouts.

## Risks

- Notion's public API may expose some newer block types differently from the Notion app UI.
- Notion button blocks may not map cleanly to public website CTA semantics.
- Synced blocks may require extra fetching or may not expose duplicated content in every case.
- Too many preset components can make generated projects feel noisy.
- Custom component blocks can become a hidden DSL if the convention grows without restraint.
- Layout pages need stronger visual QA than article pages.

## Open Questions

- Should `site` become the default immediately, or only after the renderer split ships?
- Should custom components live in the generated app only, or should `@notionx/core` expose reusable helpers?
- Should page-level `Layout` live in the existing pages data source, or should each content source define its own layout fields?
- Should `child_database` render as a configured content list, or should it remain unsupported until there is an explicit mapping layer?
- How much Notion color styling should be preserved versus normalized into site theme tokens?

## Success Criteria

- New projects can choose a UI preset at scaffold time.
- `site` projects can render rich Notion pages without hand-editing React code.
- The generated Notion renderer covers the major page-building blocks.
- Custom component blocks unlock high-design sections without making normal pages complex.
- Minimal projects remain small and easy to understand.
- The generated README clearly explains the Notion block-to-component model.

