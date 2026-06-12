// packages/create-nextion-app/src/provision/notion.ts
//
// Provisions a Notion data source for the project's first content
// source. Uses the `ntn` CLI (must be installed globally) and the
// Notion integration token from `NOTION_API_TOKEN`.
//
// The Notion API requires a parent (a page) for database creation —
// integrations normally cannot create at the workspace root — so we
// always prompt the user for a parent page id (or accept a flag).

import { runNtn, runOrThrowNtn } from "./shell.js";
import type { AnswersContentField } from "../prompt.js";

export interface NotionProvisionResult {
  dataSourceId: string;
  databaseId: string;
  url: string;
  created: boolean;
  /** Number of seed pages inserted (0 if seeding was skipped). */
  seeded: number;
}

export interface NotionProvisionInput {
  apiToken: string;
  parentPageId: string;
  title: string;
  fields: AnswersContentField[];
  /** Number of demo pages to seed. 0 to skip. */
  seedCount: number;
}

type NotionPropertyDefinition = Record<string, Record<string, never>>;
type NotionPropertyMap = Record<string, NotionPropertyDefinition>;

interface SeedFieldNames {
  title: string;
  slug?: string;
  description?: string;
  published?: string;
  date?: string;
  tags?: string;
  cover?: string;
}

interface SamplePageInput {
  index: number;
  titlePropertyName: string;
  databaseId: string;
  title: string;
  fieldNames: SeedFieldNames;
}

/** Best-effort: pick a Notion property type from a camelCase key. */
function notionPropertyType(key: string, notionName: string): string {
  const normalized = notionName.trim().toLowerCase();
  if (key === "title" || normalized === "title" || normalized === "name") {
    return "title";
  }
  if (key === "published") return "checkbox";
  if (key === "date") return "date";
  if (key === "tags") return "multi_select";
  if (key === "cover") return "files";
  return "rich_text";
}

/** Build the Notion `properties` object for database creation. */
function buildProperties(
  fields: AnswersContentField[]
): NotionPropertyMap {
  const props: NotionPropertyMap = {};
  for (const f of fields) {
    const type = notionPropertyType(f.key, f.notionName);
    props[f.notionName] = { [type]: {} };
  }
  // Notion requires a `title` property — if the user didn't include
  // one, add a synthetic one (the generated models.ts will need to be
  // adjusted to point at it).
  if (!Object.values(props).some((p) => "title" in p)) {
    props["Name"] = { title: {} };
  }
  return props;
}

function resolveTitlePropertyName(properties: NotionPropertyMap): string {
  const entry = Object.entries(properties).find(([, value]) => "title" in value);
  return entry?.[0] ?? "Name";
}

async function getDataSourceSchema(
  apiToken: string,
  dataSourceId: string
): Promise<NotionPropertyMap> {
  const stdout = await runOrThrowNtn(["api", `v1/data_sources/${dataSourceId}`], {
    env: { NOTION_API_TOKEN: apiToken },
  });
  const raw = JSON.parse(stdout) as { properties?: NotionPropertyMap };
  return raw.properties ?? {};
}

function findMatchingField(
  properties: NotionPropertyMap,
  fields: AnswersContentField[],
  key: string,
  fallback: string
): string | undefined {
  const configured = fields.find((field) => field.key === key)?.notionName;
  if (configured && properties[configured]) return configured;
  if (properties[fallback]) return fallback;
  return configured;
}

function buildSamplePage(input: SamplePageInput) {
  const { fieldNames, index, title, titlePropertyName, databaseId } = input;
  const sampleTitle = `Sample Post ${index}`;
  const properties: Record<string, unknown> = {
    [titlePropertyName]: {
      title: [{ text: { content: sampleTitle } }],
    },
  };

  if (fieldNames.slug) {
    properties[fieldNames.slug] = {
      rich_text: [{ text: { content: `sample-post-${index}` } }],
    };
  }
  if (fieldNames.description) {
    properties[fieldNames.description] = {
      rich_text: [{ text: { content: `Sample summary for post ${index}.` } }],
    };
  }
  if (fieldNames.published) {
    properties[fieldNames.published] = { checkbox: true };
  }
  if (fieldNames.date) {
    properties[fieldNames.date] = {
      date: { start: `2026-06-0${Math.min(index, 9)}` },
    };
  }
  if (fieldNames.tags) {
    properties[fieldNames.tags] = {
      multi_select: [{ name: "Getting Started" }, { name: "Sample" }],
    };
  }

  return {
    parent: { type: "database_id", database_id: databaseId },
    cover: {
      type: "external",
      external: {
        url: `https://picsum.photos/seed/${slugify(title)}-${index}/1200/600`,
      },
    },
    properties,
    children: [
      {
        object: "block",
        type: "heading_1",
        heading_1: {
          rich_text: [{ type: "text", text: { content: sampleTitle } }],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content:
                  "This starter stores article metadata in the database and the real post body in page content blocks.",
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content:
                  "Use this page as the editing surface for long-form writing, embeds, and richer Notion-native content.",
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "What to edit next" } }],
        },
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            {
              type: "text",
              text: {
                content: "Replace this sample intro with your own opening.",
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            {
              type: "text",
              text: {
                content:
                  "Update the tags, date, and cover in the database columns.",
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content:
                  "Once Published is checked, the generated site can surface this post publicly.",
              },
            },
          ],
        },
      },
    ],
  };
}

/** Probe `ntn` — returns true if it's installed. */
export async function isNtnAvailable(): Promise<boolean> {
  // `ntn --version` is read-only, but it still calls libuv's
  // `uv_tty_init` on startup, so we have to keep the PTY-aware
  // wrapper for it to actually exit 0. The cost is one extra
  // `unbuffer` fork per scaffolder run.
  const r = await runNtn(["--version"]);
  return r.code === 0;
}

/**
 * Verify the Notion API token is valid by fetching the bot user.
 *
 * We deliberately use `/v1/users/me` (the authenticated self-fetch),
 * not `/v1/users` (the full user list), because:
 *
 *   - The former works for *all* Notion token types — internal
 *     integrations (`secret_…`), OAuth public integrations, and
 *     personal access tokens (`ntn_…`) issued by the `ntn` CLI.
 *   - The latter requires the `user.read` capability on internal
 *     integrations, and is **forbidden for personal access tokens**
 *     with the message "Personal access tokens cannot list users".
 *     That breaks the auto-detect path for users who have run
 *     `ntn login`.
 */
export async function verifyNotionToken(apiToken: string): Promise<boolean> {
  const r = await runNtn(["api", "v1/users/me"], {
    env: { NOTION_API_TOKEN: apiToken },
  });
  if (r.code === 0) return true;
  // Surface the actual API error in the caller's exception so users
  // see *why* their token was rejected (e.g. "403 restricted_resource").
  const detail =
    r.stderr.trim() || r.stdout.trim() || `exit code ${r.code ?? "null"}`;
  throw new Error(`Notion token verification failed: ${detail}`);
}

/**
 * Create a Notion database (and its default data source) under the
 * given parent page. Optionally seed it with placeholder pages.
 *
 * The 2025-09-03 Notion API version split "database" into two
 * objects: a database shell (container) and one or more data
 * sources (the schema). `POST /v1/databases` still creates the
 * shell with a *default* data source, but the `properties` field
 * on that request is silently ignored when the data source schema
 * hasn't been opened for writes. To actually create properties we
 * have to follow up with `PATCH /v1/data_sources/{id}` to define
 * them. Without that second call the database ends up with the
 * `Name` fallback property only, and `POST /v1/pages` later fails
 * with "X is not a property that exists".
 */
export async function ensureNotionDatabase(
  input: NotionProvisionInput
): Promise<NotionProvisionResult> {
  const properties = buildProperties(input.fields);
  // Notion doesn't let us rename the default `Name` title after
  // creation — to use a custom name (e.g. `Title`) we have to
  // hint it on the create call. If the user didn't bring their
  // own title column, we set the default to "Title" so the
  // scaffolded schema matches the rest of the field names.
  const titleProp = Object.entries(properties).find(([, value]) => "title" in value);
  const dbTitlePropName = titleProp ? titleProp[0] : "Name";

  const body = {
    parent: { type: "page_id", page_id: input.parentPageId },
    title: [
      { type: "text", text: { content: input.title } },
    ],
    // The 2025-09 Notion API does honor the *title* property's
    // name on `POST /v1/databases` — but it ignores any other
    // properties on the same call. We send the title here and
    // PATCH the rest onto the data source below.
    properties: titleProp
      ? { [titleProp[0]]: { title: {} } }
      : { [dbTitlePropName]: { title: {} } },
  };

  const stdout = await runOrThrowNtn(
    ["api", "v1/databases", "-d", JSON.stringify(body)],
    { env: { NOTION_API_TOKEN: input.apiToken } }
  );

  const db = JSON.parse(stdout) as {
    id: string;
    url?: string;
    data_sources?: Array<{ id: string }>;
  };
  const dataSourceId = db.data_sources?.[0]?.id ?? db.id;
  const databaseId = db.id;
  const url = db.url ?? `https://www.notion.so/${databaseId.replace(/-/g, "")}`;

  // Step 2: write the non-title schema to the default data source.
  // Notion rejects calls that try to add *only* a `title` property
  // (every data source already has one), so we filter the title
  // out before PATCHing. We can't rename the title here either
  // — the create call above set the canonical name.
  const nonTitleProps = Object.fromEntries(
    Object.entries(properties).filter(([, v]) => !("title" in v))
  );
  if (Object.keys(nonTitleProps).length > 0) {
    const patchBody = { properties: nonTitleProps };
    await runOrThrowNtn(
      [
        "api",
        `v1/data_sources/${dataSourceId}`,
        "-X",
        "PATCH",
        "-d",
        JSON.stringify(patchBody),
      ],
      { env: { NOTION_API_TOKEN: input.apiToken } }
    );
  }

  let seeded = 0;
  if (input.seedCount > 0) {
    const schema = await getDataSourceSchema(input.apiToken, dataSourceId);
    seeded = await seedPlaceholderPages(
      input.apiToken,
      databaseId,
      dataSourceId,
      input.title,
      input.fields,
      schema,
      input.seedCount
    );
  }

  return {
    dataSourceId,
    databaseId,
    url,
    created: true,
    seeded,
  };
}

async function seedPlaceholderPages(
  apiToken: string,
  databaseId: string,
  dataSourceId: string,
  title: string,
  fields: AnswersContentField[],
  schema: NotionPropertyMap,
  count: number
): Promise<number> {
  let ok = 0;
  const titlePropertyName = resolveTitlePropertyName(schema);
  const fieldNames: SeedFieldNames = {
    title: titlePropertyName,
    slug: findMatchingField(schema, fields, "slug", "Slug"),
    description: findMatchingField(schema, fields, "description", "Description"),
    published: findMatchingField(schema, fields, "published", "Published"),
    date: findMatchingField(schema, fields, "date", "Date"),
    tags: findMatchingField(schema, fields, "tags", "Tags"),
    cover: findMatchingField(schema, fields, "cover", "Cover"),
  };

  for (let i = 1; i <= count; i++) {
    const body = buildSamplePage({
      index: i,
      titlePropertyName,
      databaseId,
      title,
      fieldNames,
    });
    const r = await runNtn(["api", "v1/pages", "-d", JSON.stringify(body)], {
      env: { NOTION_API_TOKEN: apiToken },
    });
    if (r.code === 0) {
      ok++;
    } else {
      // Surface the API's actual error so the operator can see why
      // a sample page didn't land. We log the first failure at warn
      // level (later ones are usually the same root cause).
      const detail = (r.stderr || r.stdout).trim().slice(0, 500);
      console.warn(
        `[notion seed] page #${i} for "${title}" failed (code ${r.code}): ${detail}`
      );
    }
  }
  return ok;
}

/** Provide a reasonable default value for common content-source field keys. */
function sampleValueFor(key: string, i: number): string {
  switch (key) {
    case "slug":
      return `sample-${i}`;
    case "description":
    case "excerpt":
    case "summary":
      return `A short sample ${key} for post #${i} — replace with your own copy.`;
    case "author":
      return `Author ${i}`;
    default:
      return `Sample ${key} #${i}`;
  }
}

/** Lowercase, ascii-only slug suitable for a picsum seed token. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "post";
}

export const _internal = {
  notionPropertyType,
  buildProperties,
  resolveTitlePropertyName,
  buildSamplePage,
  buildSiteSettingsProperties,
  buildSiteSettingsSeedPage,
};

// ---------------------------------------------------------------------------
// Site settings (singleton row)
//
// The generated project reads site-level config (name, tagline, description,
// default locale, social image) from a dedicated Notion data source. The
// scaffolder creates that data source here, with a fixed schema the runtime
// loader knows how to read, and seeds a single row pre-populated with the
// project name + a placeholder description. Operators can edit the row in
// Notion after scaffolding; changes show up within 5 minutes (KV cache TTL)
// or immediately via the admin revalidate endpoint.
// ---------------------------------------------------------------------------

/** Field names the runtime loader reads in `lib/site/settings.ts`. */
export const SITE_SETTINGS_FIELDS = [
  "Site Name", // title
  "Tagline", // rich_text
  "Description", // rich_text
  "Default Locale", // select
  "Social Image", // url
] as const;

export interface SiteSettingsProvisionInput {
  apiToken: string;
  parentPageId: string;
  projectName: string;
  /** Initial description seeded into the row. */
  description: string;
  /** Initial default locale seeded into the row (e.g. "en"). */
  defaultLocale: string;
}

export type SiteSettingsProvisionResult = NotionProvisionResult;

/**
 * Build the Notion `properties` object for the site-settings data source.
 *
 * Mirrors `siteSettingsSource.fields` in the generated
 * `lib/content/models.ts`:
 *   - `Site Name` → title (Notion's only title column)
 *   - `Tagline`   → rich_text
 *   - `Description` → rich_text
 *   - `Default Locale` → select
 *   - `Social Image` → url
 *
 * Keep the `SITE_SETTINGS_FIELDS` array in sync with this map. The
 * scaffolder's seed row and the runtime loader both depend on it.
 */
export function buildSiteSettingsProperties(): NotionPropertyMap {
  const props: NotionPropertyMap = {
    "Site Name": { title: {} },
    Tagline: { rich_text: {} },
    Description: { rich_text: {} },
    "Default Locale": { select: {} },
    "Social Image": { url: {} },
  };
  return props;
}

/**
 * Build the single seed page for the site-settings data source.
 *
 * The page carries the project name and a placeholder description so
 * the home page renders something useful before the operator customizes
 * it in Notion. The runtime loader falls back to
 * `fallbackSiteConfig` if the row is missing, so an unedited seed
 * page is fine — but a populated one means the very first request
 * after scaffolding already shows the right site name everywhere.
 */
export function buildSiteSettingsSeedPage(input: {
  projectName: string;
  description: string;
  defaultLocale: string;
  databaseId: string;
}) {
  return {
    parent: { type: "database_id", database_id: input.databaseId },
    properties: {
      "Site Name": {
        title: [{ text: { content: input.projectName } }],
      },
      Tagline: {
        rich_text: [{ text: { content: input.projectName } }],
      },
      Description: {
        rich_text: [{ text: { content: input.description } }],
      },
      "Default Locale": {
        select: { name: input.defaultLocale },
      },
    },
  };
}

/**
 * Create the site-settings data source under the given parent page and
 * insert the seed row. Same Notion API dance as
 * `ensureNotionDatabase`, minus the multi-page seeding — the singleton
 * row is created up front so the home page works before the operator
 * has opened Notion.
 */
export async function ensureSiteSettingsDatabase(
  input: SiteSettingsProvisionInput
): Promise<SiteSettingsProvisionResult> {
  const properties = buildSiteSettingsProperties();
  const titleProp = Object.entries(properties).find(
    ([, value]) => "title" in value
  );
  const dbTitlePropName = titleProp ? titleProp[0] : "Site Name";

  const body = {
    parent: { type: "page_id", page_id: input.parentPageId },
    title: [
      { type: "text", text: { content: `${input.projectName} Site Settings` } },
    ],
    properties: titleProp
      ? { [titleProp[0]]: { title: {} } }
      : { [dbTitlePropName]: { title: {} } },
  };

  const stdout = await runOrThrowNtn(
    ["api", "v1/databases", "-d", JSON.stringify(body)],
    { env: { NOTION_API_TOKEN: input.apiToken } }
  );

  const db = JSON.parse(stdout) as {
    id: string;
    url?: string;
    data_sources?: Array<{ id: string }>;
  };
  const dataSourceId = db.data_sources?.[0]?.id ?? db.id;
  const databaseId = db.id;
  const url = db.url ?? `https://www.notion.so/${databaseId.replace(/-/g, "")}`;

  // Write the non-title schema to the default data source. Notion
  // refuses to add a *second* title property, so we filter it out
  // before the PATCH (same dance as the content source provisioner).
  const nonTitleProps = Object.fromEntries(
    Object.entries(properties).filter(([, v]) => !("title" in v))
  );
  if (Object.keys(nonTitleProps).length > 0) {
    const patchBody = { properties: nonTitleProps };
    await runOrThrowNtn(
      [
        "api",
        `v1/data_sources/${dataSourceId}`,
        "-X",
        "PATCH",
        "-d",
        JSON.stringify(patchBody),
      ],
      { env: { NOTION_API_TOKEN: input.apiToken } }
    );
  }

  // Insert the seed row.
  const seed = buildSiteSettingsSeedPage({
    projectName: input.projectName,
    description: input.description,
    defaultLocale: input.defaultLocale,
    databaseId,
  });
  const seedResult = await runNtn(
    ["api", "v1/pages", "-d", JSON.stringify(seed)],
    { env: { NOTION_API_TOKEN: input.apiToken } }
  );
  if (seedResult.code !== 0) {
    const detail = (seedResult.stderr || seedResult.stdout).trim().slice(0, 500);
    console.warn(
      `[notion site-settings seed] failed (code ${seedResult.code}): ${detail}`
    );
  }

  return {
    dataSourceId,
    databaseId,
    url,
    created: true,
    seeded: seedResult.code === 0 ? 1 : 0,
  };
}
