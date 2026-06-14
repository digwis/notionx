# Structured Page Blocks Design

## Summary

This design upgrades the scaffold's first-phase reusable page blocks from
"stable variant shell + generic `NotionBlocks` body" into explicit,
component-driven block types backed by strongly-structured Notion fields.

The second phase keeps the current separation of concerns:

- `Pages` stores only ordered block references
- `Blocks` stores reusable block definitions
- runtime code resolves block references into concrete UI components

The main change is that `hero`, `feature-grid`, and `story` stop treating
Notion page body blocks as their primary content source. Instead, each block
type receives a fixed schema and renders through dedicated shadcn/ui-based
components with predictable props.

## Goals

- Make `hero`, `feature-grid`, and `story` render through explicit React
  components rather than generic `NotionBlocks`.
- Give each block type a stable, strongly-typed Notion schema.
- Keep `Pages` lightweight by storing only block references, not embedded block
  payloads.
- Preserve block reuse across multiple pages through the standalone `Blocks`
  data source.
- Keep the scaffold-generated starter content editable in Notion without
  requiring code changes for ordinary content edits.
- Provide a migration path from the current first-phase block model without
  breaking existing scaffold output.

## Non-Goals

- Do not build a general-purpose page builder.
- Do not support arbitrary user-defined block types in this change.
- Do not introduce Notion native synced block parsing.
- Do not redesign article/blog content rendering.
- Do not remove generic `NotionBlocks` from the project entirely; they remain
  available as a compatibility fallback outside the three structured block
  types.

## Current State

The scaffold already provisions:

- a `Pages` data source with a `Blocks` JSON reference field
- a standalone `Blocks` data source
- runtime resolution from page block references to block records
- a `PageBlocks` renderer that switches on `variant`

However, the current `PageBlocks` implementation still renders every resolved
block body through `NotionBlocks`. The variant changes outer layout and shell
styling only. This means:

- block internals are not truly componentized
- required content shape is implicit rather than enforced
- data validation is weak
- the starter cannot guarantee a stable visual result for each block type

## Proposed Behavior

### Supported Structured Block Types

Phase two formalizes three block types:

- `hero`
- `feature-grid`
- `story`

Each type is rendered by a dedicated component:

- `HeroBlock`
- `FeatureGridBlock`
- `StoryBlock`

Runtime dispatch must be based on the resolved block record's `type`, not only
on the page reference `variant`.

### Pages Model

The `Pages.Blocks` field remains a JSON array of references:

```json
[
  { "slug": "home-hero", "order": 10 },
  { "slug": "home-feature-grid", "order": 20 }
]
```

The page record continues to own:

- block ordering
- page-level inclusion

The block record continues to own:

- content
- component type
- reusable presentation settings

`variant` on page references becomes optional compatibility metadata. The
runtime may still read it as a temporary fallback, but the canonical source of
truth is the block record's `Type` field.

### Blocks Schema

All block records keep a shared base schema:

- `Name`
- `Slug`
- `Status`
- `Type`
- `Description`
- `Page Keys`
- `Order`
- `Cover`

Then each supported type receives additional fixed fields.

#### Hero Fields

- `Eyebrow`
- `Headline`
- `Subheadline`
- `Primary CTA Label`
- `Primary CTA Href`
- `Secondary CTA Label`
- `Secondary CTA Href`
- `Alignment`
- `Theme`

#### Feature Grid Fields

- `Headline`
- `Description`
- `Columns`
- `Items`

`Items` is stored as JSON with a stable shape:

```json
[
  {
    "title": "Notion editing",
    "description": "Editors update content without code changes.",
    "icon": "pen-square",
    "href": "/blog"
  }
]
```

#### Story Fields

- `Headline`
- `Body`
- `Quote`
- `Quote Attribution`
- `Media Url`
- `Layout`

## Runtime Data Model

The runtime should map raw Notion rows into explicit structured block records.

Suggested internal shape:

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
      items: Array<{
        title: string;
        description: string;
        icon: string;
        href?: string;
      }>;
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
    };
```

The current generic `blocks: NotionBlock[]` payload should not be the primary
input for these structured components.

## Component Rendering

### Hero

`HeroBlock` renders:

- optional eyebrow badge
- headline
- subheadline
- one or two CTA buttons
- alignment-aware layout

It should use existing shadcn/ui primitives such as `Button` and `Badge`.

### Feature Grid

`FeatureGridBlock` renders:

- section heading
- supporting description
- responsive grid of cards

Each item renders through a small card subcomponent built on shadcn/ui
`Card`, `CardHeader`, and `CardContent`.

### Story

`StoryBlock` renders:

- section heading
- body copy
- optional quote block
- optional media region

It should support a small fixed set of layouts rather than freeform placement.

## Compatibility Strategy

Existing first-phase projects may already contain block records whose useful
content lives only in page body blocks. To avoid breaking them:

1. If a block row matches one of the new structured types and has the required
   structured fields, render the explicit component.
2. If the block row is missing required structured fields but still has Notion
   page body blocks, render the old generic `NotionBlocks` fallback shell.
3. New scaffold output must seed all three supported block types using the new
   structured fields so fresh projects immediately use the explicit components.

This gives the scaffold a forward path without forcing immediate migration of
every previously generated demo project.

## Provisioning Changes

The Notion provisioning layer must:

- extend the `Blocks` schema with the new type-specific fields
- update sample block seed data so `hero`, `feature-grid`, and `story` rows are
  fully populated through structured fields
- keep `Pages.Blocks` references stable
- keep additive-only schema patch behavior on reuse

Reused databases should gain missing fields, but no destructive type changes or
automatic property renames should occur.

## Error Handling

- If a block row has an unsupported `Type`, skip it and log a warning in
  development.
- If a structured block is missing required fields, fall back to the generic
  shell only when legacy body blocks exist; otherwise skip it.
- If `Items` JSON is invalid for `feature-grid`, skip the block rather than
  rendering malformed cards.
- If CTA pairs are incomplete, drop the incomplete CTA instead of rendering an
  unusable button.
- If `Columns` or `Layout` is invalid, normalize to a safe default.

## Testing

Add or update targeted tests for:

- `Blocks` schema generation including all new type-specific fields
- sample block seed payload generation for `hero`, `feature-grid`, and `story`
- page reference resolution choosing structured component rendering
- fallback behavior when a legacy block lacks required structured fields
- invalid JSON handling for `feature-grid.Items`
- render output including the new structured block component files

Tests should focus on the new typed block flow rather than re-testing unrelated
blog or site-settings behavior.

## Risks

- Notion rich text and JSON fields are editor-friendly but not strongly typed,
  so runtime normalization must be conservative.
- If too many optional fields are introduced, component behavior becomes harder
  to reason about. The schema should stay intentionally narrow.
- A mixed compatibility period means runtime logic is temporarily more complex
  because it must support both structured and legacy fallback block content.

## Validation

- Scaffold a fresh project and confirm home/about render through explicit block
  components without relying on `NotionBlocks` body content.
- Reuse an existing first-phase project and confirm old block rows still render
  via compatibility fallback.
- Edit structured block fields in Notion and confirm the generated UI updates
  without code changes.
- Intentionally corrupt a `feature-grid.Items` JSON payload and confirm the page
  degrades safely instead of crashing.
