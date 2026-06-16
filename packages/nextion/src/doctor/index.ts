// Re-export the detailed report builder used by the CLI and starter tests.
export {
  buildNotionxDoctorReport,
  formatNotionxDoctorReport,
} from "./doctor";
export type {
  NotionxDoctorCheck,
  NotionxDoctorModel,
  NotionxDoctorReport,
  NotionxDoctorStatus,
  EnvLike,
  WranglerConfigLike,
} from "./doctor";
export type { ContentModelDefinition, NotionFieldMap } from "./model";

import {
  buildNotionxDoctorReport,
  formatNotionxDoctorReport,
  type EnvLike,
  type NotionxDoctorReport,
  type WranglerConfigLike,
} from "./doctor";

/**
 * Public, runtime-driven doctor API. Consumers (the worker bootstrap,
 * scripts, CI) pass a runtime that exposes binding lookups; the doctor
 * derives a synthetic wrangler config from it and runs the full report.
 *
 * `sources` is a list of project content sources. For now, the doctor
 * ignores their detailed shape; future phases will surface per-source
 * data-source status as findings.
 */
export type DoctorFinding = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export type RuntimeLike = {
  getBinding(name: string): unknown;
};

export type RunNotionxDoctorOptions = {
  env: EnvLike;
  runtime: RuntimeLike;
  sources: readonly unknown[];
  wranglerConfig?: WranglerConfigLike | null;
};

export type NotionxDoctorFindingsReport = NotionxDoctorReport & {
  findings: DoctorFinding[];
};

function deriveWranglerConfig(runtime: RuntimeLike): WranglerConfigLike {
  return {
    d1_databases: runtime.getBinding("DB") ? [{ binding: "DB" }] : [],
    r2_buckets: runtime.getBinding("ASSETS_BUCKET")
      ? [{ binding: "ASSETS_BUCKET" }]
      : [],
    images: runtime.getBinding("IMAGES") ? { binding: "IMAGES" } : undefined,
  };
}

function checkToFindingCode(checkId: string): string {
  if (checkId === "runtime.database") return "missing-db-binding";
  if (checkId === "runtime.objectStorage") return "missing-r2-binding";
  if (checkId === "runtime.imageTransformer") return "missing-images-binding";
  if (checkId === "runtime.observability") return "observability-disabled";
  if (checkId === "notion.token") return "missing-notion-token";
  if (checkId === "notion.webhook") return "missing-notion-webhook";
  return checkId;
}

function checkToFinding(check: import("./doctor").NotionxDoctorCheck): DoctorFinding {
  const severity: DoctorFinding["severity"] =
    check.status === "missing" ? "error" : check.status === "warn" ? "warning" : "info";
  return {
    code: checkToFindingCode(check.id),
    message: check.action ?? check.detail,
    severity,
  };
}

function modelToFinding(
  model: import("./doctor").NotionxDoctorModel
): DoctorFinding | null {
  if (model.dataSourceStatus !== "missing") return null;
  return {
    code: `missing-data-source:${model.id}`,
    message: `Set ${model.dataSourceEnv} for the ${model.id} content model or add a model defaultDataSourceId.`,
    severity: "error",
  };
}

export function runNotionxDoctor(
  options: RunNotionxDoctorOptions
): NotionxDoctorFindingsReport {
  const wranglerConfig = options.wranglerConfig ?? deriveWranglerConfig(options.runtime);
  const report = buildNotionxDoctorReport({
    env: options.env,
    wranglerConfig,
    // Phase 6 will map `sources` (ContentSource[]) to the detailed model
    // shape used by `buildNotionxDoctorReport`. For now, treat the
    // empty array as the default and rely on binding/env checks.
    models: [],
  });
  const findings: DoctorFinding[] = [
    ...report.checks
      .filter((check) => check.status !== "ok")
      .map(checkToFinding),
    ...report.models
      .map(modelToFinding)
      .filter((finding): finding is DoctorFinding => finding !== null),
  ];
  return { ...report, findings };
}

export { formatNotionxDoctorReport as formatDoctorReport };
