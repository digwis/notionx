// worker/routes/health.ts
//
// GET /api/health - 健康检查端点
// 用于监控、容器编排、load balancer 健康探测
// 顺便验证 SQL database adapter 连接是否正常
//
// The package exports a Next.js handler and a worker-friendly single-arg
// handler. The two are equivalent; only the calling convention differs.
//
// The database check is domain-agnostic: it issues a `SELECT 1` to
// confirm the SQL adapter is reachable, then runs the foundation
// schema guard to ensure the auth tables are present.

import { NextResponse } from "next/server";
import { getDatabase } from "../../platform/current";
import { runSchemaHealthChecks } from "../../internal/admin/schema-guard";

export const dynamic = "force-dynamic";

async function probeDatabase(): Promise<{
  ok: boolean;
  error: string | null;
  postsTableExists: boolean;
}> {
  const database = getDatabase();
  try {
    const result = await database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='posts' LIMIT 1"
      )
      .first<{ name?: string }>();
    return {
      ok: true,
      error: null,
      postsTableExists: Boolean(result?.name),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      postsTableExists: false,
    };
  }
}

export const healthRoute = {
  async GET() {
    return healthRoute.handle(new Request("https://health.local/api/health"));
  },
  async handle(_request: Request): Promise<Response> {
    const start = Date.now();
    const probe = await probeDatabase();
    const d1Ok = probe.ok;
    const d1Error = probe.error;

    let schemaOk = false;
    let schemaError: string | null = null;
    let schemaMissing: string[] = [];
    try {
      const schema = await runSchemaHealthChecks(getDatabase());
      schemaOk = schema.ok;
      schemaMissing = schema.missing;
      if (schema.errors.length > 0) {
        schemaError = schema.errors.join("; ");
      } else if (schema.missing.length > 0) {
        schemaError = `missing required schema: ${schema.missing.join(", ")}`;
      }
    } catch (e) {
      schemaError = e instanceof Error ? e.message : String(e);
    }

    const allHealthy = d1Ok && schemaOk;

    return NextResponse.json(
      {
        status: allHealthy ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        uptime_ms: Date.now() - start,
        checks: {
          d1: d1Ok ? "ok" : "error",
          d1_error: d1Error,
          schema: schemaOk ? "ok" : "error",
          schema_error: schemaError,
          schema_missing: schemaMissing,
        },
        version: "1.0.0",
      },
      {
        status: allHealthy ? 200 : 503,
        headers: {
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  },
};

// Top-level aliases for callers that prefer a flat signature.
export const GET = healthRoute.GET;

/**
 * Worker-friendly single-arg handler. Used by the Cloudflare Workers
 * bootstrap in `@notionx/core/worker`. Equivalent to
 * `healthRoute.handle`.
 */
export async function healthRouteHandle(request: Request): Promise<Response> {
  return healthRoute.handle(request);
}
