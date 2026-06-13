# Notion Provision Stable Reuse Design

## Summary

This design makes `@notionx/create-nextion-app` reuse the same Notion databases
across repeated scaffold provisioning runs by attaching a stable scaffold-owned
identifier to each provisioned database. Future runs resolve databases by that
identifier first, then fall back to the current `parentPageId + title` matching
logic for backward compatibility.

The goal is to stop repeated runs from creating duplicate tables when the same
Notion parent page is reused, while still allowing the scaffold to patch missing
schema fields onto previously created databases. Existing databases created by
older scaffold versions remain compatible and will be upgraded in place the next
time they are matched.

## Goals

- Reuse previously provisioned Notion databases even if their visible titles are
  later renamed by the user.
- Keep current schema patch behavior: add missing fields, but do not perform
  destructive type changes or automatic renames.
- Migrate older scaffold-created databases forward without requiring users to
  delete and recreate them.
- Preserve the current best-effort provisioning flow and avoid introducing a
  hard requirement for a dedicated update command.
- Keep content and Pages databases independently identifiable.

## Non-Goals

- Do not build a general-purpose Notion schema migration engine.
- Do not add automatic property renaming or property type conversion.
- Do not introduce a project-level `update` CLI in this change.
- Do not redesign the content model preset system or generated runtime code.

## Current State

The scaffold currently reuses a Notion database only when both of these match:

- the parent page id
- the visible database title

When a match is found, provisioning patches only missing properties on the data
source schema and skips reseeding sample entries. This works for idempotent
re-runs as long as the database title has not changed. If the title changes, the
scaffold can no longer prove identity and may create a new database under the
same parent page.

## Proposed Behavior

### Stable Keys

Each scaffold-managed database gets a stable key derived from its role:

- content database: `content:<contentSourceId>`
- site pages database: `pages:default`

The key must be stable across reruns, independent of project name, locale, or
visible database title.

### Persistence Mechanism

The scaffold persists the stable key on the Notion database object itself using
database description metadata managed by the Notion API. The stored description
must include a machine-readable marker owned by the scaffold. The format should
be explicit and grep-friendly:

```text
[nextion-scaffold] key=content:blog
```

or:

```text
[nextion-scaffold] key=pages:default
```

If a database already has user-authored description text, the scaffold appends
its marker rather than replacing the entire description.

### Resolution Order

When provisioning a database, lookup must follow this order:

1. Search candidate databases under the same parent page and resolve a database
   whose description contains the exact scaffold marker for the expected stable
   key.
2. If no marker match is found, fall back to the existing `parentPageId + title`
   logic.
3. If fallback logic finds an older database, patch the scaffold marker onto it
   before returning success.
4. If neither lookup finds a database, create a new one and immediately write
   the scaffold marker.

This keeps the change backward-compatible while allowing one successful rerun to
upgrade legacy databases into the new identification model.

### Schema Updates

After resolving the target database, the scaffold continues to:

- fetch the current data source schema
- add properties that are missing
- warn when an existing property type differs from the desired type
- leave mismatched or renamed properties untouched

This preserves the current low-risk behavior and avoids damaging editor-managed
data.

### Seeding Rules

Seeding stays unchanged:

- new databases may be seeded
- reused databases are not reseeded

This prevents duplicate sample entries and keeps repeat runs idempotent.

## Data Flow

For each provisioned database, the flow becomes:

1. Compute desired stable key.
2. Search the parent page for a database with the scaffold marker.
3. If found, retrieve database/data source ids and continue.
4. If not found, use legacy title-based matching.
5. If legacy match succeeds, patch the scaffold marker onto that database.
6. Ensure missing schema properties exist.
7. Seed only if the database was newly created.

## Implementation Outline

### Notion Helpers

Add helper functions in `packages/create-nextion-app/src/provision/notion.ts`
to:

- normalize and extract database description text
- build the scaffold marker string for a stable key
- detect whether a database description already contains a given marker
- patch the database description without dropping unrelated user description text

### Database Discovery

Refactor database lookup into two explicit paths:

- `findExistingDatabaseByStableKey(...)`
- existing title fallback, retained as a separate helper

The stable-key lookup should inspect search results under the same parent page
and return the most recently edited exact match if multiple matches exist, with
a warning for ambiguity.

### Provision Call Sites

Update both provisioning entry points to pass stable keys:

- `ensureNotionDatabase(...)` uses `content:<contentSourceId>`
- `ensurePagesDatabase(...)` uses `pages:default`

This requires extending `NotionProvisionInput` with a stable content source id,
or otherwise passing the stable key explicitly from the caller.

### Legacy Upgrade Path

Whenever fallback title matching succeeds on a database without a scaffold
marker, patch the marker immediately and then proceed with normal schema patch
logic. This creates an in-place migration without requiring a separate user
action.

## Error Handling

- If marker patching fails after a database is found, provisioning should fail
  the Notion step rather than silently proceeding without persistence, because
  that would keep duplicate-creation risk alive.
- If description parsing fails for a specific search result, skip that result and
  continue scanning.
- If multiple databases under the same parent page share the same stable marker,
  reuse the most recently edited one and emit a warning so the user can clean up
  duplicates manually.
- If the Notion API does not expose writable database descriptions in a specific
  environment, the implementation must stop and surface that incompatibility
  clearly rather than pretending stable reuse is active.

## Testing

Add or update targeted tests for:

- marker string creation and parsing
- stable-key match when description already contains the scaffold marker
- legacy title fallback when marker is absent
- forward migration that patches the marker onto a legacy database
- description patching that preserves unrelated user description content
- duplicate marker matches selecting the most recently edited database
- schema patch behavior remaining additive-only

Tests should stay focused on lookup and patch behavior, not on re-testing Notion
sample page payload generation that is already covered elsewhere.

## Risks

- The Notion API surface around database description metadata may differ from the
  assumptions in the current CLI wrapper, so the implementation must verify the
  exact request/response shape before coding against it.
- Some existing databases may already contain manually written descriptions, so
  description patch logic must be conservative and append-only.
- Marker-based lookup still depends on Notion search returning relevant database
  results under the target parent page.

## Validation

- Re-run provisioning against the same parent page twice and confirm no second
  content or Pages database is created.
- Rename the visible database title in Notion, re-run provisioning, and confirm
  the existing database is still reused.
- Start from a legacy database without a marker, re-run provisioning, and
  confirm the marker is added in place.
- Change the preset by adding a new field, re-run provisioning, and confirm only
  the missing field is added.
- Confirm no sample pages are inserted on reuse.
