// GET /api/health - 健康检查端点
// 用于监控、容器编排、load balancer 健康探测
// 顺便验证 SQL database adapter 连接是否正常

import { NextResponse } from "next/server";
import { getAllPosts } from "@/lib/posts";
import { getDatabase } from "@/lib/platform/current";
import { runSchemaHealthChecks } from "@/lib/schema-guard.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  let d1Ok = false;
  let d1Error: string | null = null;
  let postCount = 0;
  let schemaOk = false;
  let schemaError: string | null = null;
  let schemaMissing: string[] = [];
  try {
    const posts = await getAllPosts();
    postCount = posts.length;
    d1Ok = true;
  } catch (e) {
    d1Error = e instanceof Error ? e.message : String(e);
  }

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
        post_count: postCount,
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
}
