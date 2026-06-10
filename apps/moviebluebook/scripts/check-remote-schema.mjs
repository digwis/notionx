import { execFileSync } from "node:child_process";

const databaseName = "vinext-blog";
const checks = [
  {
    label: "app_settings.turnstile_enabled",
    sql: "SELECT turnstile_enabled FROM app_settings LIMIT 1",
  },
  {
    label: "users.session_rev",
    sql: "SELECT session_rev FROM users LIMIT 1",
  },
  {
    label: "auth_rate_limits",
    sql: "SELECT 1 FROM auth_rate_limits LIMIT 1",
  },
  {
    label: "content_search_index",
    sql: "SELECT 1 FROM content_search_index LIMIT 1",
  },
];

function runWranglerCheck({ label, sql }) {
  console.log(`[deploy:check] verifying ${label}`);
  execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      databaseName,
      "--remote",
      "--command",
      sql,
    ],
    {
      stdio: "inherit",
      cwd: process.cwd(),
      env: process.env,
    }
  );
}

async function checkHealthEndpoint(url) {
  console.log(`[deploy:check] fetching ${url}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "cache-control": "no-cache",
      },
    });

    if (!res.ok) {
      throw new Error(`health check failed with status ${res.status}`);
    }

    const payload = await res.json();
    if (payload?.checks?.schema !== "ok") {
      throw new Error(
        `health check reported schema=${payload?.checks?.schema ?? "unknown"}`
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

for (const check of checks) {
  runWranglerCheck(check);
}

const healthUrl =
  process.env.HEALTHCHECK_URL ??
  "https://vinext-blog.moviebluebook.workers.dev/api/health";

try {
  await checkHealthEndpoint(healthUrl);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (process.env.REQUIRE_HEALTHCHECK === "1") {
    throw error;
  }
  console.warn(
    `[deploy:check] health verification failed (${message}); set REQUIRE_HEALTHCHECK=1 to enforce`
  );
}

console.log("[deploy:check] remote schema checks passed");
