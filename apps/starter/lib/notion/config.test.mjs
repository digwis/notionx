import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { defineContentModel } from "../content/model.ts";
import {
  getNotionConfigForModel,
  hasNotionModelConfig,
} from "./config.ts";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "..",
    "..",
    "packages",
    "foundation",
    "src",
    "notion",
    "config.ts"
  ),
  "utf8"
);

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

test("notion config merges only non-empty environment values", () => {
  assert.match(source, /function mergeEnv/);
  assert.match(source, /const value = readString\(source, name\)/);
  assert.match(source, /if \(value\) merged\[name\] = value/);
});

function modelWithEnv(dataSourceEnv, defaultDataSourceId) {
  return defineContentModel({
    id: "dynamic",
    kind: "catalog",
    visibility: {
      public: true,
      admin: false,
    },
    source: {
      type: "notion",
      tokenEnv: "NOTION_TOKEN",
      dataSourceEnv,
      defaultDataSourceId,
      fields: {
        title: "Title",
      },
      query: {
        pageSize: 100,
      },
    },
    routes: {
      listPath: "/dynamic",
      detailPath: "/dynamic/[slug]",
      detailParam: "slug",
    },
    ui: {
      name: "Dynamic",
      pluralName: "Dynamics",
      navLabel: "Dynamic",
      listTitle: "Dynamic",
      listDescription: "Dynamic content.",
      emptyState: "No dynamic content.",
    },
    capabilities: {
      richBlocks: true,
      coverImages: false,
      gatedAssets: false,
    },
  });
}

test("getNotionConfigForModel reads dynamic model data source env", async () => {
  const previousToken = process.env.NOTION_TOKEN;
  const previousDataSource = process.env.NOTION_BOOKS_DATA_SOURCE_ID;
  const previousEditBase = process.env.NOTION_EDIT_BASE_URL;

  process.env.NOTION_TOKEN = "secret";
  process.env.NOTION_BOOKS_DATA_SOURCE_ID = "books-data-source";
  process.env.NOTION_EDIT_BASE_URL = "https://notion.example/{pageId}";

  try {
    const config = await getNotionConfigForModel(
      modelWithEnv("NOTION_BOOKS_DATA_SOURCE_ID")
    );

    assert.equal(config.token, "secret");
    assert.equal(config.dataSourceId, "books-data-source");
    assert.equal(config.editBaseUrl, "https://notion.example/{pageId}");
  } finally {
    restoreEnv("NOTION_TOKEN", previousToken);
    restoreEnv("NOTION_BOOKS_DATA_SOURCE_ID", previousDataSource);
    restoreEnv("NOTION_EDIT_BASE_URL", previousEditBase);
  }
});

test("hasNotionModelConfig accepts a default data source id", async () => {
  const previousToken = process.env.NOTION_TOKEN;
  const previousDataSource = process.env.NOTION_ARCHIVE_DATA_SOURCE_ID;

  process.env.NOTION_TOKEN = "secret";
  delete process.env.NOTION_ARCHIVE_DATA_SOURCE_ID;

  try {
    assert.equal(
      await hasNotionModelConfig(
        modelWithEnv("NOTION_ARCHIVE_DATA_SOURCE_ID", "default-source")
      ),
      true
    );
  } finally {
    restoreEnv("NOTION_TOKEN", previousToken);
    restoreEnv("NOTION_ARCHIVE_DATA_SOURCE_ID", previousDataSource);
  }
});
