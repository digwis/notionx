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
  const res = await fetch(url, {
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
}

for (const check of checks) {
  runWranglerCheck(check);
}

if (process.env.HEALTHCHECK_URL) {
  await checkHealthEndpoint(process.env.HEALTHCHECK_URL);
} else {
  console.log(
    "[deploy:check] HEALTHCHECK_URL not set, skipping HTTP health verification"
  );
}

console.log("[deploy:check] remote schema checks passed");
