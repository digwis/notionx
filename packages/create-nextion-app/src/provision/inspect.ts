import { readFile } from "node:fs/promises";
import path from "node:path";
import { setWorkerSecret } from "./cloudflare.js";
import { run } from "./shell.js";

type LocalNotionSecretState = {
  notionToken?: string;
  notionDataSourceId?: string;
  notionPagesDataSourceId?: string;
};

function parseEnvLike(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    out[match[1]] = match[2];
  }
  return out;
}

async function readLocalNotionSecretState(
  projectDir: string
): Promise<LocalNotionSecretState> {
  try {
    const devVarsPath = path.join(projectDir, ".dev.vars");
    const raw = await readFile(devVarsPath, "utf8");
    const env = parseEnvLike(raw);
    return {
      notionToken: env.NOTION_TOKEN?.trim() || undefined,
      notionDataSourceId: env.NOTION_DATA_SOURCE_ID?.trim() || undefined,
      notionPagesDataSourceId: env.NOTION_PAGES_DATA_SOURCE_ID?.trim() || undefined,
    };
  } catch {
    return {};
  }
}

async function listRemoteWorkerSecretNames(projectDir: string): Promise<Set<string>> {
  const result = await run("wrangler", ["secret", "list", "--format", "json"], {
    cwd: projectDir,
  });
  if (result.code !== 0) {
    throw new Error(`wrangler secret list failed:\n${result.stderr || result.stdout}`);
  }

  const parsed = JSON.parse(result.stdout) as Array<{ name?: string }>;
  return new Set(parsed.map((entry) => String(entry.name ?? "").trim()).filter(Boolean));
}

/**
 * Entry shape for provision repair. We accept a minimal struct
 * rather than a full project context — the inspector only
 * needs the project directory.
 */
export interface ProvisionRepairEntry {
  label: string;
  kind: "cloudflare";
  group: "cloudflareBinding";
  risk: "safe";
  apply(): Promise<void>;
}

export async function inspectProvisionRepair(
  projectDir: string,
): Promise<ProvisionRepairEntry[]> {
  const local = await readLocalNotionSecretState(projectDir);
  const remoteNames = await listRemoteWorkerSecretNames(projectDir);
  const entries: ProvisionRepairEntry[] = [];

  const addSecretEntry = (name: string, value: string | undefined) => {
    if (!value) return;
    if (remoteNames.has(name)) return;
    entries.push({
      label: `cloudflare-secret:${name}`,
      kind: "cloudflare",
      group: "cloudflareBinding",
      risk: "safe",
      async apply() {
        await setWorkerSecret(name, value, projectDir, [value]);
      },
    });
  };

  addSecretEntry("NOTION_TOKEN", local.notionToken);
  addSecretEntry("NOTION_DATA_SOURCE_ID", local.notionDataSourceId);
  addSecretEntry("NOTION_PAGES_DATA_SOURCE_ID", local.notionPagesDataSourceId);

  return entries;
}
