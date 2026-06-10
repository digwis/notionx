import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFoundationDoctorReport,
  formatFoundationDoctorReport,
} from "../lib/foundation/doctor.ts";

const projectRoot = process.cwd();

function parseArgs(argv) {
  const result = {
    json: false,
  };

  for (const arg of argv) {
    if (arg === "--json") {
      result.json = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return result;
}

function stripJsonComments(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
        output += char;
      }
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    output += char;
  }

  return output;
}

function readJsonc(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(stripJsonComments(fs.readFileSync(filePath, "utf8")));
}

function readDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) continue;

    const name = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[name] = value;
  }
  return env;
}

function mergedEnv(wranglerConfig) {
  return {
    ...wranglerConfig?.vars,
    ...readDotEnvFile(path.join(projectRoot, ".env.local")),
    ...readDotEnvFile(path.join(projectRoot, ".dev.vars")),
    ...process.env,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const wranglerConfig = readJsonc(path.join(projectRoot, "wrangler.jsonc"));
  const report = buildFoundationDoctorReport({
    env: mergedEnv(wranglerConfig),
    wranglerConfig,
  });

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatFoundationDoctorReport(report));
  }

  if (report.overall.status === "missing") {
    process.exitCode = 1;
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
