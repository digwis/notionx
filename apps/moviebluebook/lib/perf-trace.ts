// lib/perf-trace.ts
// 在 Server Component / Server Action 中用 perfSpan 给关键调用打 span。
// 输出统一为 `tag:"perf" kind:"span"` 的紧凑 JSON 行，可被 Cloudflare Logs /
// Query Builder 收集，按 kind / page_class / span / branch 过滤。
//
// 设计原则：
// - 不抛出，不破坏调用方；try/catch 兜底。
// - 即使 Workers 端 `console.log` 没有 Tail 抓取也不影响功能。
// - span 名允许 "." 用于分组，例如 "d1.getPostBySlug" / "auth.isAuthenticated"。
// - 用全局 `performance`（workerd / Node 18+ 都可用），避免在 Workers 里
//   require('node:perf_hooks') 触发 ESM 错误。

type SpanInput = {
  span: string;
  pageClass?: string;
  branch?: string;
  extra?: Record<string, unknown>;
};

export async function perfSpan<T>(
  input: SpanInput,
  fn: () => Promise<T>
): Promise<T> {
  const t0 = performance.now();
  let ok = true;
  let errName: string | undefined;
  try {
    return await fn();
  } catch (e) {
    ok = false;
    errName = e instanceof Error ? e.name : "Error";
    throw e;
  } finally {
    const ms = Math.round((performance.now() - t0) * 100) / 100;
    const line = {
      tag: "perf",
      kind: "span",
      ts: Date.now(),
      span: input.span,
      page_class: input.pageClass,
      branch: input.branch,
      ok,
      err: ok ? undefined : errName,
      duration_ms: ms,
      ...(input.extra ?? {}),
    };
    safeLog(line);
  }
}

/** 同步版的 perfSpan：用于 cheap 的 JS 函数 */
export function perfSpanSync<T>(input: SpanInput, fn: () => T): T {
  const t0 = performance.now();
  let ok = true;
  let errName: string | undefined;
  try {
    return fn();
  } catch (e) {
    ok = false;
    errName = e instanceof Error ? e.name : "Error";
    throw e;
  } finally {
    const ms = Math.round((performance.now() - t0) * 100) / 100;
    const line = {
      tag: "perf",
      kind: "span",
      ts: Date.now(),
      span: input.span,
      page_class: input.pageClass,
      branch: input.branch,
      ok,
      err: ok ? undefined : errName,
      duration_ms: ms,
      ...(input.extra ?? {}),
    };
    safeLog(line);
  }
}

function safeLog(payload: Record<string, unknown>) {
  try {
    // 用紧凑 JSON，避免 Cloudflare 把 splat 打散成多行
    console.log(JSON.stringify(payload));
  } catch {
    // 忽略序列化错误
  }
}
