// packages/create-nextion-app/src/provision/notion.ts
//
// Provisions a Notion data source for the project's first content
// source. Uses the `ntn` CLI (must be installed globally) and the
// Notion integration token from `NOTION_API_TOKEN`.
//
// The Notion API requires a parent (a page) for database creation —
// integrations normally cannot create at the workspace root — so we
// always prompt the user for a parent page id (or accept a flag).

import { runOrThrow, run } from "./shell.js";
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

/** Best-effort: pick a Notion property type from a camelCase key. */
function notionPropertyType(key: string, notionName: string): string {
  if (key === "title" || notionName.toLowerCase() === "title") return "title";
  // The user can refine types in Notion later; rich_text is the safest
  // default for short-form text fields.
  return "rich_text";
}

/** Build the Notion `properties` object for database creation. */
function buildProperties(
  fields: AnswersContentField[]
): Record<string, { [type: string]: Record<string, never> }> {
  const props: Record<string, { [type: string]: Record<string, never> }> = {};
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

/** Probe `ntn` — returns true if it's installed. */
export async function isNtnAvailable(): Promise<boolean> {
  const r = await run("ntn", ["--version"], {});
  return r.code === 0;
}

/**
 * Verify the NOTION_API_TOKEN is valid by listing users (lightweight
 * authenticated read). Returns true on success.
 */
export async function verifyNotionToken(apiToken: string): Promise<boolean> {
  const r = await run("ntn", ["api", "v1/users", "page_size==1"], {
    env: { NOTION_API_TOKEN: apiToken },
  });
  return r.code === 0;
}

/**
 * Create a Notion database (and its default data source) under the
 * given parent page. Optionally seed it with placeholder pages.
 */
export async function ensureNotionDatabase(
  input: NotionProvisionInput
): Promise<NotionProvisionResult> {
  const properties = buildProperties(input.fields);
  const body = {
    parent: { type: "page_id", page_id: input.parentPageId },
    title: [
      { type: "text", text: { content: input.title } },
    ],
    properties,
  };

  const stdout = await runOrThrow(
    "ntn",
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

  let seeded = 0;
  if (input.seedCount > 0) {
    seeded = await seedPlaceholderPages(
      input.apiToken,
      databaseId,
      dataSourceId,
      input.title,
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
  count: number
): Promise<number> {
  let ok = 0;
  for (let i = 1; i <= count; i++) {
    const body = {
      parent: { type: "database_id", database_id: databaseId },
      // Newer Notion API requires `data_source_id` for writes when
      // a database has multiple data sources. The default data source
      // is always present at index 0; we set it explicitly to be safe.
      ...(dataSourceId !== databaseId
        ? { data_source_id: dataSourceId }
        : {}),
      properties: {
        // Notion requires the `title` property; we don't know its key
        // here, so we set both common names — Notion ignores the
        // missing one and accepts the present one.
        title: {
          title: [{ text: { content: `${title} sample #${i}` } }],
        },
        Name: {
          title: [{ text: { content: `${title} sample #${i}` } }],
        },
      },
    };
    const r = await run("ntn", ["api", "v1/pages", "-d", JSON.stringify(body)], {
      env: { NOTION_API_TOKEN: apiToken },
    });
    if (r.code === 0) ok++;
  }
  return ok;
}
