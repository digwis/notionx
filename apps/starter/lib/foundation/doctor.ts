import type { ContentModelDefinition, NotionFieldMap } from "../content/model.ts";
import { contentModels } from "../content/models.ts";
import {
  getRuntimeAdapter,
  type RuntimeAdapterDefinition,
} from "../platform/capabilities.ts";
import { currentRuntimeId, type RuntimeId } from "../platform/selection.ts";

export type FoundationDoctorStatus = "ok" | "warn" | "missing";

export type EnvLike = Record<string, string | undefined>;

export type WranglerConfigLike = {
  vars?: EnvLike;
  d1_databases?: Array<{ binding?: string }>;
  r2_buckets?: Array<{ binding?: string }>;
  images?: { binding?: string } | Array<{ binding?: string }>;
  observability?: { enabled?: boolean };
};

export type FoundationDoctorCheck = {
  id: string;
  label: string;
  status: FoundationDoctorStatus;
  required: boolean;
  detail: string;
  action?: string;
};

export type FoundationDoctorModel = {
  id: string;
  public: boolean;
  admin: boolean;
  listPath: string;
  detailPath: string;
  publicApiPath?: string;
  dataSourceEnv: string;
  dataSourceStatus: FoundationDoctorStatus;
  dataSourceSource: "env" | "default" | "missing";
};

export type FoundationDoctorReport = {
  overall: {
    status: FoundationDoctorStatus;
    summary: string;
  };
  runtime: {
    id: RuntimeId;
    label: string;
    adapterStatus: RuntimeAdapterDefinition["status"];
  };
  checks: FoundationDoctorCheck[];
  models: FoundationDoctorModel[];
  nextSteps: string[];
};

type BuildFoundationDoctorReportOptions = {
  env?: EnvLike;
  runtimeId?: RuntimeId;
  wranglerConfig?: WranglerConfigLike | null;
  models?: readonly ContentModelDefinition<NotionFieldMap>[];
};

function envValue(env: EnvLike, name: string) {
  const value = String(env[name] ?? "").trim();
  return value || undefined;
}

function hasEnv(env: EnvLike, name: string) {
  return Boolean(envValue(env, name));
}

function hasD1Binding(config: WranglerConfigLike | null | undefined, binding: string) {
  return Boolean(config?.d1_databases?.some((item) => item.binding === binding));
}

function hasR2Binding(config: WranglerConfigLike | null | undefined, binding: string) {
  return Boolean(config?.r2_buckets?.some((item) => item.binding === binding));
}

function hasImagesBinding(
  config: WranglerConfigLike | null | undefined,
  binding: string
) {
  const images = config?.images;
  if (Array.isArray(images)) {
    return images.some((item) => item.binding === binding);
  }
  return images?.binding === binding;
}

function statusSummary(status: FoundationDoctorStatus) {
  if (status === "ok") return "ready";
  if (status === "warn") return "usable with warnings";
  return "missing required configuration";
}

function overallStatus(
  checks: readonly FoundationDoctorCheck[],
  models: readonly FoundationDoctorModel[]
): FoundationDoctorStatus {
  if (
    checks.some((check) => check.status === "missing") ||
    models.some((model) => model.dataSourceStatus === "missing")
  ) {
    return "missing";
  }

  if (
    checks.some((check) => check.status === "warn") ||
    models.some((model) => model.dataSourceStatus === "warn")
  ) {
    return "warn";
  }

  return "ok";
}

function cloudflareChecks(
  config: WranglerConfigLike | null | undefined
): FoundationDoctorCheck[] {
  return [
    {
      id: "runtime.database",
      label: "SQL database",
      status: hasD1Binding(config, "DB") ? "ok" : "missing",
      required: true,
      detail: hasD1Binding(config, "DB")
        ? "wrangler D1 binding DB is declared"
        : "wrangler D1 binding DB is missing",
      action: "Add a DB binding under d1_databases in wrangler.jsonc.",
    },
    {
      id: "runtime.objectStorage",
      label: "Object storage",
      status: hasR2Binding(config, "ASSETS_BUCKET") ? "ok" : "warn",
      required: false,
      detail: hasR2Binding(config, "ASSETS_BUCKET")
        ? "wrangler R2 binding ASSETS_BUCKET is declared"
        : "uploads and persistent media cache need ASSETS_BUCKET",
      action: "Add an ASSETS_BUCKET R2 binding for uploads and media cache.",
    },
    {
      id: "runtime.imageTransformer",
      label: "Image transformation",
      status: hasImagesBinding(config, "IMAGES") ? "ok" : "warn",
      required: false,
      detail: hasImagesBinding(config, "IMAGES")
        ? "wrangler Images binding IMAGES is declared"
        : "Notion media optimization will fall back without IMAGES",
      action: "Add a Cloudflare Images binding named IMAGES.",
    },
    {
      id: "runtime.publicCache",
      label: "Public cache",
      status: "ok",
      required: true,
      detail: "vinext CDN adapter handles page cache; caches.default remains for media",
    },
    {
      id: "runtime.observability",
      label: "Observability",
      status: config?.observability?.enabled ? "ok" : "warn",
      required: false,
      detail: config?.observability?.enabled
        ? "wrangler observability is enabled"
        : "wrangler observability is not enabled",
      action: "Enable observability in wrangler.jsonc for production debugging.",
    },
  ];
}

function notionChecks(env: EnvLike): FoundationDoctorCheck[] {
  return [
    {
      id: "notion.token",
      label: "Notion token",
      status: hasEnv(env, "NOTION_TOKEN") ? "ok" : "missing",
      required: true,
      detail: hasEnv(env, "NOTION_TOKEN")
        ? "NOTION_TOKEN is configured"
        : "NOTION_TOKEN is missing",
      action: "Set NOTION_TOKEN to an internal integration token.",
    },
    {
      id: "notion.webhook",
      label: "Notion webhook verification",
      status: hasEnv(env, "NOTION_WEBHOOK_VERIFICATION_TOKEN") ? "ok" : "warn",
      required: false,
      detail: hasEnv(env, "NOTION_WEBHOOK_VERIFICATION_TOKEN")
        ? "NOTION_WEBHOOK_VERIFICATION_TOKEN is configured"
        : "instant content invalidation needs NOTION_WEBHOOK_VERIFICATION_TOKEN",
      action:
        "Set NOTION_WEBHOOK_VERIFICATION_TOKEN after creating the Notion webhook.",
    },
  ];
}

function modelDoctorStatus(
  env: EnvLike,
  model: ContentModelDefinition<NotionFieldMap>
): Pick<
  FoundationDoctorModel,
  "dataSourceStatus" | "dataSourceSource"
> {
  const hasConfiguredEnv = hasEnv(env, model.source.dataSourceEnv);
  const hasDefault = Boolean(model.source.defaultDataSourceId);
  const dataSourceSource = hasConfiguredEnv
    ? "env"
    : hasDefault
      ? "default"
      : "missing";
  const dataSourceStatus = dataSourceSource === "missing" ? "missing" : "ok";

  return {
    dataSourceStatus,
    dataSourceSource,
  };
}

function modelChecks(
  env: EnvLike,
  models: readonly ContentModelDefinition<NotionFieldMap>[]
): FoundationDoctorModel[] {
  return models.map((model) => ({
    id: model.id,
    public: model.visibility.public,
    admin: model.visibility.admin,
    listPath: model.routes.listPath,
    detailPath: model.routes.detailPath,
    publicApiPath: model.routes.publicApiPath,
    dataSourceEnv: model.source.dataSourceEnv,
    ...modelDoctorStatus(env, model),
  }));
}

function uniqueActions(checks: readonly FoundationDoctorCheck[]) {
  return Array.from(
    new Set(
      checks
        .filter((check) => check.status !== "ok" && check.action)
        .map((check) => check.action as string)
    )
  );
}

function omitResolvedActions(check: FoundationDoctorCheck): FoundationDoctorCheck {
  if (check.status !== "ok") return check;
  return {
    ...check,
    action: undefined,
  };
}

export function buildFoundationDoctorReport(
  options: BuildFoundationDoctorReportOptions = {}
): FoundationDoctorReport {
  const env = options.env ?? process.env;
  const runtimeId = options.runtimeId ?? currentRuntimeId();
  const adapter = getRuntimeAdapter(runtimeId);
  const checks = [
    ...cloudflareChecks(options.wranglerConfig),
    ...notionChecks(env),
  ].map(omitResolvedActions);
  const models = modelChecks(env, options.models ?? contentModels);
  const status = overallStatus(checks, models);
  const modelActions = models
    .filter((model) => model.dataSourceStatus === "missing")
    .map(
      (model) =>
        `Set ${model.dataSourceEnv} for the ${model.id} content model or add a model defaultDataSourceId.`
    );

  return {
    overall: {
      status,
      summary: statusSummary(status),
    },
    runtime: {
      id: runtimeId,
      label: adapter?.label ?? runtimeId,
      adapterStatus: adapter?.status ?? "planned",
    },
    checks,
    models,
    nextSteps: [...uniqueActions(checks), ...modelActions],
  };
}

function formatCheck(check: FoundationDoctorCheck) {
  const required = check.required ? "required" : "optional";
  return `  [${check.status}] ${check.label} (${required}) - ${check.detail}`;
}

function formatModel(model: FoundationDoctorModel) {
  const visibility = [
    model.public ? "public" : "",
    model.admin ? "admin" : "",
  ].filter(Boolean);
  const source =
    model.dataSourceSource === "env"
      ? model.dataSourceEnv
      : model.dataSourceSource === "default"
        ? `${model.dataSourceEnv} or model default`
        : model.dataSourceEnv;

  return [
    `  [${model.dataSourceStatus}] ${model.id} (${visibility.join(", ") || "private"})`,
    `      routes: ${model.listPath}, ${model.detailPath}${
      model.publicApiPath ? `, ${model.publicApiPath}` : ""
    }`,
    `      notion: ${source}`,
  ].join("\n");
}

export function formatFoundationDoctorReport(report: FoundationDoctorReport) {
  const lines = [
    "vinext foundation doctor",
    "",
    `Overall: [${report.overall.status}] ${report.overall.summary}`,
    `Runtime: ${report.runtime.label} (${report.runtime.id}, ${report.runtime.adapterStatus})`,
    "",
    "Checks:",
    ...report.checks.map(formatCheck),
    "",
    "Content models:",
    ...report.models.map(formatModel),
  ];

  if (report.nextSteps.length > 0) {
    lines.push("", "Next steps:");
    for (const step of report.nextSteps) {
      lines.push(`  - ${step}`);
    }
  }

  return lines.join("\n");
}
