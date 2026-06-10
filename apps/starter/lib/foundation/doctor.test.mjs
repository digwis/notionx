import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFoundationDoctorReport,
  formatFoundationDoctorReport,
} from "./doctor.ts";
import { contentModels } from "../content/models.ts";

const wranglerConfig = {
  vars: {
    NOTION_MOVIES_DATA_SOURCE_ID: "movies-source",
  },
  d1_databases: [{ binding: "DB" }],
  r2_buckets: [{ binding: "ASSETS_BUCKET" }],
  images: { binding: "IMAGES" },
  observability: { enabled: true },
};

test("foundation doctor reports a configured Cloudflare foundation", () => {
  const report = buildFoundationDoctorReport({
    env: {
      NOTION_TOKEN: "secret-token",
      NOTION_DATA_SOURCE_ID: "blog-source",
      NOTION_MOVIES_DATA_SOURCE_ID: "movies-source",
      NOTION_WEBHOOK_VERIFICATION_TOKEN: "webhook-secret",
    },
    wranglerConfig,
    models: contentModels,
  });

  assert.equal(report.overall.status, "ok");
  assert.equal(report.runtime.id, "cloudflare-workers");
  assert.deepEqual(
    report.checks.map((check) => [check.id, check.status]),
    [
      ["runtime.database", "ok"],
      ["runtime.objectStorage", "ok"],
      ["runtime.imageTransformer", "ok"],
      ["runtime.publicCache", "ok"],
      ["runtime.observability", "ok"],
      ["notion.token", "ok"],
      ["notion.webhook", "ok"],
    ]
  );
  assert.deepEqual(
    report.models.map((model) => [model.id, model.dataSourceStatus]),
    [
      ["blog", "ok"],
      ["movies", "ok"],
      ["movie-translations", "ok"],
    ]
  );
});

test("foundation doctor flags missing custom model data source", () => {
  const customModel = {
    id: "courses",
    kind: "catalog",
    visibility: { public: true, admin: false },
    source: {
      type: "notion",
      tokenEnv: "NOTION_TOKEN",
      dataSourceEnv: "NOTION_COURSES_DATA_SOURCE_ID",
      fields: { title: "Name" },
      query: { pageSize: 100 },
    },
    routes: {
      listPath: "/courses",
      detailPath: "/courses/[slug]",
      detailParam: "slug",
      publicApiPath: "/api/courses",
    },
    ui: {
      name: "Courses",
      pluralName: "Courses",
      navLabel: "Courses",
      listTitle: "Courses",
      listDescription: "Courses from Notion.",
      emptyState: "No courses yet.",
    },
    capabilities: {
      richBlocks: true,
      coverImages: true,
      gatedAssets: false,
    },
  };
  const report = buildFoundationDoctorReport({
    env: {
      NOTION_TOKEN: "secret-token",
      NOTION_DATA_SOURCE_ID: "blog-source",
    },
    wranglerConfig,
    models: [customModel],
  });

  assert.equal(report.overall.status, "missing");
  const courses = report.models.find((model) => model.id === "courses");
  assert.equal(courses?.dataSourceStatus, "missing");
  assert.ok(
    report.nextSteps.includes(
      "Set NOTION_COURSES_DATA_SOURCE_ID for the courses content model or add a model defaultDataSourceId."
    )
  );
});

test("foundation doctor formatter omits secret values", () => {
  const report = buildFoundationDoctorReport({
    env: {
      NOTION_TOKEN: "super-secret-token",
      NOTION_DATA_SOURCE_ID: "blog-source",
    },
    wranglerConfig,
    models: contentModels,
  });

  const output = formatFoundationDoctorReport(report);
  assert.match(output, /vinext foundation doctor/);
  assert.match(output, /NOTION_TOKEN is configured/);
  assert.match(output, /Content models:/);
  assert.doesNotMatch(output, /super-secret-token/);
});
