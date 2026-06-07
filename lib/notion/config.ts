type NotionEnv = {
  NOTION_TOKEN?: string;
  NOTION_DATA_SOURCE_ID?: string;
  NOTION_MOVIES_DATA_SOURCE_ID?: string;
  NOTION_API_BASE_URL?: string;
  NOTION_EDIT_BASE_URL?: string;
  NOTION_WEBHOOK_VERIFICATION_TOKEN?: string;
};

export const DEFAULT_NOTION_MOVIES_DATA_SOURCE_ID =
  "371dc62d-0738-8015-a601-000bc3944fcb";

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
  return {
    NOTION_TOKEN: process.env.NOTION_TOKEN,
    NOTION_DATA_SOURCE_ID: process.env.NOTION_DATA_SOURCE_ID,
    NOTION_MOVIES_DATA_SOURCE_ID: process.env.NOTION_MOVIES_DATA_SOURCE_ID,
    NOTION_API_BASE_URL: process.env.NOTION_API_BASE_URL,
    NOTION_EDIT_BASE_URL: process.env.NOTION_EDIT_BASE_URL,
    NOTION_WEBHOOK_VERIFICATION_TOKEN:
      process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN,
  };
}

async function readWorkerEnv(): Promise<NotionEnv> {
  try {
    const mod = (await import(
      /* webpackIgnore: true */ "cloudflare:workers"
    )) as { env?: NotionEnv };
    return mod.env ?? {};
  } catch {
    return {};
  }
}

function readString(source: NotionEnv, name: keyof NotionEnv): string | undefined {
  const value = String(source[name] ?? "").trim();
  return value || undefined;
}

function mergeEnv(...sources: NotionEnv[]): NotionEnv {
  const merged: NotionEnv = {};
  const names: (keyof NotionEnv)[] = [
    "NOTION_TOKEN",
    "NOTION_DATA_SOURCE_ID",
    "NOTION_MOVIES_DATA_SOURCE_ID",
    "NOTION_API_BASE_URL",
    "NOTION_EDIT_BASE_URL",
    "NOTION_WEBHOOK_VERIFICATION_TOKEN",
  ];

  for (const source of sources) {
    for (const name of names) {
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
  name: "NOTION_TOKEN" | "NOTION_DATA_SOURCE_ID"
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

export async function hasNotionMovieConfig(): Promise<boolean> {
  const env = await readEnv();
  return Boolean(readString(env, "NOTION_TOKEN"));
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

export async function getNotionMovieConfig(): Promise<NotionConfig> {
  const env = await readEnv();
  return {
    token: readRequired(env, "NOTION_TOKEN"),
    dataSourceId:
      readString(env, "NOTION_MOVIES_DATA_SOURCE_ID") ??
      DEFAULT_NOTION_MOVIES_DATA_SOURCE_ID,
    apiBaseUrl: readString(env, "NOTION_API_BASE_URL"),
    editBaseUrl: readString(env, "NOTION_EDIT_BASE_URL"),
    webhookVerificationToken: readString(
      env,
      "NOTION_WEBHOOK_VERIFICATION_TOKEN"
    ),
  };
}
