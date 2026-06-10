import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TURNSTILE_PUBLIC_CONFIG,
  buildTurnstilePublicConfig,
  isSchemaDriftError,
  runSchemaHealthChecks,
} from "./schema-guard.js";

test("isSchemaDriftError detects missing column and table errors", () => {
  assert.equal(
    isSchemaDriftError(new Error("no such column: turnstile_enabled")),
    true
  );
  assert.equal(
    isSchemaDriftError(new Error("no such table: auth_rate_limits")),
    true
  );
  assert.equal(isSchemaDriftError(new Error("network timeout")), false);
});

test("buildTurnstilePublicConfig disables widget when not fully configured", () => {
  const config = buildTurnstilePublicConfig(
    {
      turnstile_enabled: 1,
      turnstile_site_key: null,
    },
    {
      TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
    }
  );

  assert.deepEqual(config, {
    enabled: false,
    siteKey: null,
    secretConfigured: false,
  });
  assert.deepEqual(DEFAULT_TURNSTILE_PUBLIC_CONFIG, {
    enabled: false,
    siteKey: null,
    secretConfigured: false,
  });
});

test("runSchemaHealthChecks reports missing required schema objects", async () => {
  const failures = new Map([
    [
      "SELECT turnstile_enabled FROM app_settings LIMIT 1",
      new Error("no such column: turnstile_enabled"),
    ],
    [
      "SELECT 1 FROM auth_rate_limits LIMIT 1",
      new Error("no such table: auth_rate_limits"),
    ],
  ]);
  const db = {
    prepare(sql) {
      return {
        async first() {
          const failure = failures.get(sql);
          if (failure) throw failure;
          return { ok: 1 };
        },
      };
    },
  };

  const result = await runSchemaHealthChecks(db);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, [
    "app_settings.turnstile_enabled",
    "auth_rate_limits",
  ]);
  assert.deepEqual(result.errors, []);
});

test("runSchemaHealthChecks surfaces unexpected database errors separately", async () => {
  const db = {
    prepare() {
      return {
        async first() {
          throw new Error("database is locked");
        },
      };
    },
  };

  const result = await runSchemaHealthChecks(db);

  assert.equal(result.ok, false);
  assert.equal(result.missing.length, 0);
  assert.equal(result.errors.length, 3);
  assert.match(result.errors[0], /database is locked/);
});
