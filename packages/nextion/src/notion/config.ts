import type { NotionContentModelLike } from "./types";

type NotionEnv = {
  NOTION_TOKEN?: string;
  NOTION_DATA_SOURCE_ID?: string;
  NOTION_API_BASE_URL?: string;
  NOTION_EDIT_BASE_URL?: string;
  NOTION_WEBHOOK_VERIFICATION_TOKEN?: string;
  [key: string]: string | undefined;
};

export type NotionClientConfig = {
  token: string;
  apiBaseUrl?: string;
};

export type NotionConfig = {
  token: string;
  dataSourceId: string;
  apiBaseUrl?: string;
  editBaseUrl?: string;
  webhookVerificationToken?: string;
};

function readProcessEnv(): NotionEnv {
  const env: NotionEnv = {
    NOTION_TOKEN: process.env.NOTION_TOKEN,
    NOTION_DATA_SOURCE_ID: process.env.NOTION_DATA_SOURCE_ID,
    NOTION_API_BASE_URL: process.env.NOTION_API_BASE_URL,
    NOTION_EDIT_BASE_URL: process.env.NOTION_EDIT_BASE_URL,
    NOTION_WEBHOOK_VERIFICATION_TOKEN:
      process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN,
  };

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("NOTION_") && typeof value === "string") {
      env[key] = value;
    }
  }

  return env;
}

async function readWorkerEnv(): Promise<NotionEnv> {
  try {
    const mod = (await import(
      /* webpackIgnore: true */ "cloudflare:workers"
    )) as unknown as { env?: Record<string, unknown> };
    const env: NotionEnv = {};
    for (const [key, value] of Object.entries(mod.env ?? {})) {
      if (key.startsWith("NOTION_") && typeof value === "string") {
        env[key] = value;
      }
    }
    return env;
  } catch {
    return {};
  }
}

function readString(source: NotionEnv, name: string): string | undefined {
  const value = String(source[name] ?? "").trim();
  return value || undefined;
}

function mergeEnv(...sources: NotionEnv[]): NotionEnv {
  const merged: NotionEnv = {};

  for (const source of sources) {
    for (const name of Object.keys(source)) {
      if (!name.startsWith("NOTION_")) continue;
      const value = readString(source, name);
      if (value) merged[name] = value;
    }
  }

  return merged;
}

async function readEnv(): Promise<NotionEnv> {
  const processEnv = readProcessEnv();
  return mergeEnv(await readWorkerEnv(), processEnv);
}

function readRequired(
  source: NotionEnv,
  name: string
): string {
  const value = readString(source, name);
  if (!value) {
    throw new Error(`Missing required Notion env: ${name}`);
  }
  return value;
}

export function getNotionEditBaseUrl(): string {
  return readString(readProcessEnv(), "NOTION_EDIT_BASE_URL") ?? "https://www.notion.so";
}

export async function hasNotionConfig(): Promise<boolean> {
  const env = await readEnv();
  return Boolean(
    readString(env, "NOTION_TOKEN") && readString(env, "NOTION_DATA_SOURCE_ID")
  );
}

export async function hasNotionModelConfig(
  model: NotionContentModelLike
): Promise<boolean> {
  const env = await readEnv();
  return Boolean(
    readString(env, "NOTION_TOKEN") &&
      (readString(env, model.source.dataSourceEnv) ||
        model.source.defaultDataSourceId)
  );
}

export async function getNotionClientConfig(): Promise<NotionClientConfig> {
  const env = await readEnv();
  return {
    token: readRequired(env, "NOTION_TOKEN"),
    apiBaseUrl: readString(env, "NOTION_API_BASE_URL"),
  };
}

export async function getNotionConfig(): Promise<NotionConfig> {
  const env = await readEnv();
  return {
    token: readRequired(env, "NOTION_TOKEN"),
    dataSourceId: readRequired(env, "NOTION_DATA_SOURCE_ID"),
    apiBaseUrl: readString(env, "NOTION_API_BASE_URL"),
    editBaseUrl: readString(env, "NOTION_EDIT_BASE_URL"),
    webhookVerificationToken: readString(
      env,
      "NOTION_WEBHOOK_VERIFICATION_TOKEN"
    ),
  };
}

export async function getNotionWebhookVerificationToken(): Promise<
  string | undefined
> {
  const env = await readEnv();
  return readString(env, "NOTION_WEBHOOK_VERIFICATION_TOKEN");
}

export async function getNotionConfigForModel(
  model: NotionContentModelLike
): Promise<NotionConfig> {
  const env = await readEnv();
  const dataSourceId =
    readString(env, model.source.dataSourceEnv) ??
    model.source.defaultDataSourceId;
  if (!dataSourceId) {
    throw new Error(`Missing required Notion env: ${model.source.dataSourceEnv}`);
  }

  return {
    token: readRequired(env, model.source.tokenEnv),
    dataSourceId,
    apiBaseUrl: readString(env, "NOTION_API_BASE_URL"),
    editBaseUrl: readString(env, "NOTION_EDIT_BASE_URL"),
    webhookVerificationToken: readString(
      env,
      "NOTION_WEBHOOK_VERIFICATION_TOKEN"
    ),
  };
}
