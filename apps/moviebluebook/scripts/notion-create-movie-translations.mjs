#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { Client } from "@notionhq/client";

const DEFAULT_MOVIES_DATA_SOURCE_ID = "371dc62d-0738-8015-a601-000bc3944fcb";

function parseDotEnv(path) {
  if (!fs.existsSync(path)) return {};
  const env = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

function readEnv(name) {
  const dotVars = parseDotEnv(".dev.vars");
  return process.env[name] || dotVars[name] || "";
}

function text(content) {
  return [{ type: "text", text: { content } }];
}

function selectOptions(names) {
  const colors = ["blue", "green", "purple", "yellow", "orange", "red"];
  return names.map((name, index) => ({
    name,
    color: colors[index % colors.length],
  }));
}

function usage() {
  console.log(`Usage:
  node scripts/notion-create-movie-translations.mjs [--apply]

Environment:
  NOTION_TOKEN                    required
  NOTION_MOVIES_DATA_SOURCE_ID    optional, defaults to current project id
  NOTION_API_BASE_URL             optional

By default this is a dry run. Add --apply to create the Notion data source.`);
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    usage();
    return;
  }

  const apply = process.argv.includes("--apply");
  const token = readEnv("NOTION_TOKEN");
  const moviesDataSourceId =
    readEnv("NOTION_MOVIES_DATA_SOURCE_ID") || DEFAULT_MOVIES_DATA_SOURCE_ID;
  const apiBaseUrl = readEnv("NOTION_API_BASE_URL") || undefined;

  if (!token) {
    console.error(
      "Missing NOTION_TOKEN. Put it in .dev.vars or export it before running."
    );
    process.exitCode = 1;
    return;
  }

  const notion = new Client({
    auth: token,
    baseUrl: apiBaseUrl,
    notionVersion: "2026-03-11",
  });

  const movieSource = await notion.dataSources.retrieve({
    data_source_id: moviesDataSourceId,
  });

  if (!("parent" in movieSource) || movieSource.parent.type !== "database_id") {
    console.error("Movie data source is not under a normal Notion database.");
    process.exitCode = 1;
    return;
  }

  const parent = {
    type: "database_id",
    database_id: movieSource.parent.database_id,
  };

  const properties = {
    标题: { type: "title", title: {} },
    电影: {
      type: "relation",
      relation: {
        data_source_id: moviesDataSourceId,
        type: "dual_property",
        dual_property: {
          synced_property_name: "翻译版本",
        },
      },
    },
    语言: {
      type: "select",
      select: {
        options: selectOptions(["zh-CN", "en-US"]),
      },
    },
    Slug: { type: "rich_text", rich_text: {} },
    导演显示: { type: "rich_text", rich_text: {} },
    演员显示: { type: "rich_text", rich_text: {} },
    剧情简介: { type: "rich_text", rich_text: {} },
    类型显示: {
      type: "multi_select",
      multi_select: {
        options: selectOptions(["Drama", "Family", "Romance", "War"]),
      },
    },
    "SEO Title": { type: "rich_text", rich_text: {} },
    "SEO Description": { type: "rich_text", rich_text: {} },
    翻译状态: {
      type: "select",
      select: {
        options: selectOptions(["待翻译", "AI初稿", "待校对", "已发布"]),
      },
    },
    已发布: { type: "checkbox", checkbox: {} },
  };

  const request = {
    parent,
    title: text("电影翻译"),
    icon: { type: "emoji", emoji: "🌐" },
    properties,
  };

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        moviesDataSourceId,
        parentDatabaseId: parent.database_id,
        createDataSourceTitle: "电影翻译",
        relation: {
          property: "电影",
          targetDataSourceId: moviesDataSourceId,
          syncedPropertyNameOnMovies: "翻译版本",
        },
        properties: Object.keys(properties),
      },
      null,
      2
    )
  );

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to create it in Notion.");
    return;
  }

  const created = await notion.dataSources.create(request);
  console.log(
    JSON.stringify(
      {
        createdDataSourceId: created.id,
        url: "url" in created ? created.url : null,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error?.body || error?.message || String(error));
  process.exitCode = 1;
});
