# Admin First Load Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce admin first-load latency and improve perceived navigation by removing avoidable server-side serial work and unnecessary client-side overhead.

**Architecture:** Keep the current admin route structure, but shrink the request-time work performed before `/admin` can render. Cache single-row settings reads, stop running bootstrap logic on every protected request, strip login-page Turnstile debug traffic from production code, and lazy-load non-critical admin interactions so the first admin document becomes interactive sooner.

**Tech Stack:** Next.js App Router, React Server Components, Cloudflare Workers, D1, dynamic import, node:test

---

### Task 1: Add regression tests for the optimization targets

**Files:**
- Create: `lib/admin-performance-guard.test.mjs`
- Test: `lib/admin-performance-guard.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("admin layout no longer runs bootstrap on every request", () => {
  const source = read("app/admin/layout.tsx");
  assert.doesNotMatch(source, /ensureAdminBootstrap/);
});

test("turnstile field no longer posts debug events to localhost", () => {
  const source = read("components/TurnstileField.tsx");
  assert.doesNotMatch(source, /127\\.0\\.0\\.1:7777/);
  assert.doesNotMatch(source, /reportDebug/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/admin-performance-guard.test.mjs`
Expected: FAIL because `app/admin/layout.tsx` still imports `ensureAdminBootstrap` and `components/TurnstileField.tsx` still contains debug reporting.

- [ ] **Step 3: Write minimal implementation**

```tsx
// app/admin/layout.tsx
import { getAdminViewer } from "@/lib/admin-viewer";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, admin } = await getAdminViewer();
  if (!user) redirect("/login");
  // ...
}
```

```tsx
// components/TurnstileField.tsx
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

export function TurnstileField({ siteKey, action = "auth" }: Props) {
  // mount widget only, no localhost debug beacon
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/admin-performance-guard.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/admin-performance-guard.test.mjs app/admin/layout.tsx components/TurnstileField.tsx
git commit -m "test: guard admin first-load optimizations"
```

### Task 2: Collapse admin auth/viewer request-time work

**Files:**
- Modify: `lib/settings.ts`
- Modify: `lib/admin.ts`
- Modify: `lib/admin-viewer.ts`
- Modify: `app/admin/layout.tsx`
- Test: `lib/admin-performance-guard.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
test("settings helpers use request-scoped cache wrappers", () => {
  const settingsSource = read("lib/settings.ts");
  assert.match(settingsSource, /cache\\(/);
});

test("admin viewer resolves auth in a single path", () => {
  const viewerSource = read("lib/admin-viewer.ts");
  assert.match(viewerSource, /user:\\s*SessionUser \\| null/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/admin-performance-guard.test.mjs`
Expected: FAIL because `getAppSettings()` is uncached and the viewer helper does not yet own the full auth resolution path.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/settings.ts
import { cache } from "react";

const getAppSettingsCached = cache(async (): Promise<AppSettings> => {
  // existing SELECT ... FROM app_settings WHERE id = 1
});

export async function getAppSettings(): Promise<AppSettings> {
  return getAppSettingsCached();
}
```

```ts
// lib/admin-viewer.ts
import { cache } from "react";
import { getCurrentUser, type SessionUser } from "./auth";
import { isAdminEmail } from "./admin";

export const getAdminViewer = cache(async (): Promise<{
  user: SessionUser | null;
  viewerEmail: string;
  admin: boolean;
}> => {
  const user = await getCurrentUser();
  const viewerEmail = user?.email.toLowerCase() ?? "";
  const admin = viewerEmail ? await isAdminEmail(viewerEmail) : false;
  return { user, viewerEmail, admin };
});
```

```tsx
// app/admin/layout.tsx
const { user, admin } = await perfSpan(
  { span: "admin.viewer", pageClass: "admin" },
  () => getAdminViewer()
);
if (!user) redirect("/login");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/admin-performance-guard.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/settings.ts lib/admin.ts lib/admin-viewer.ts app/admin/layout.tsx lib/admin-performance-guard.test.mjs
git commit -m "perf: reduce admin first-load server work"
```

### Task 3: Defer non-critical admin client code

**Files:**
- Create: `app/admin/DeleteButtonLazy.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/new/page.tsx`
- Create: `components/NewPostFormLazy.tsx`
- Test: `lib/admin-performance-guard.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
test("admin list uses a lazy delete button wrapper", () => {
  const source = read("app/admin/page.tsx");
  assert.match(source, /DeleteButtonLazy/);
});

test("new post page uses a lazy form wrapper", () => {
  const source = read("app/admin/new/page.tsx");
  assert.match(source, /NewPostFormLazy/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/admin-performance-guard.test.mjs`
Expected: FAIL because the page still imports eager `DeleteButton` and eager `NewPostForm`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// app/admin/DeleteButtonLazy.tsx
"use client";

import dynamic from "next/dynamic";

const DeleteButton = dynamic(() => import("./DeleteButton"));

export default DeleteButton;
```

```tsx
// components/NewPostFormLazy.tsx
"use client";

import dynamic from "next/dynamic";

const NewPostForm = dynamic(() => import("@/components/NewPostForm"), {
  ssr: false,
  loading: () => <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">正在加载编辑器...</div>,
});

export default NewPostForm;
```

```tsx
// app/admin/new/page.tsx
import NewPostFormLazy from "@/components/NewPostFormLazy";

<NewPostFormLazy error={error} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/admin-performance-guard.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/DeleteButtonLazy.tsx app/admin/page.tsx app/admin/new/page.tsx components/NewPostFormLazy.tsx lib/admin-performance-guard.test.mjs
git commit -m "perf: lazy load non-critical admin client code"
```

### Task 4: Verify behavior and diagnostics

**Files:**
- Modify: `app/admin/layout.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/new/page.tsx`
- Modify: `components/TurnstileField.tsx`
- Test: `lib/admin-performance-guard.test.mjs`

- [ ] **Step 1: Run focused tests**

```bash
node --test lib/admin-performance-guard.test.mjs
```

Expected: PASS

- [ ] **Step 2: Run existing auth-related tests**

```bash
npm test
```

Expected: PASS for the existing `lib/schema-guard.test.mjs` and `lib/turnstile-client.test.mjs` suites.

- [ ] **Step 3: Check diagnostics**

```text
Get diagnostics for:
- file:///Users/zhao/项目/vinext/app/admin/layout.tsx
- file:///Users/zhao/项目/vinext/app/admin/page.tsx
- file:///Users/zhao/项目/vinext/app/admin/new/page.tsx
- file:///Users/zhao/项目/vinext/components/TurnstileField.tsx
```

Expected: no new diagnostics

- [ ] **Step 4: Commit**

```bash
git add app/admin/layout.tsx app/admin/page.tsx app/admin/new/page.tsx components/TurnstileField.tsx lib/admin-performance-guard.test.mjs
git commit -m "perf: improve admin first-load experience"
```
