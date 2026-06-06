# Admin Frame Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the admin top frame visible while admin child pages are loading, so route transitions feel more natural.

**Architecture:** Add a route-segment loading UI at `app/admin/loading.tsx`. Because the admin header already lives in `app/admin/layout.tsx`, the loading state only needs to render the content area skeleton and must not duplicate the frame.

**Tech Stack:** Next.js App Router, React Server Components, Tailwind CSS, node:test

---

### Task 1: Add a regression test for admin frame-preserving loading

**Files:**
- Modify: `lib/admin-performance-guard.test.mjs`
- Test: `lib/admin-performance-guard.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
test("admin route defines a dedicated content-only loading state", () => {
  const source = read("app/admin/loading.tsx");
  assert.match(source, /Skeleton/);
  assert.doesNotMatch(source, /vinext Admin/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/admin-performance-guard.test.mjs`
Expected: FAIL because `app/admin/loading.tsx` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="rounded-md border p-4">
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/admin-performance-guard.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/admin-performance-guard.test.mjs app/admin/loading.tsx
git commit -m "perf: preserve admin frame during loading"
```

### Task 2: Verify tests and diagnostics

**Files:**
- Modify: `app/admin/loading.tsx`
- Modify: `lib/admin-performance-guard.test.mjs`

- [ ] **Step 1: Run focused test**

```bash
node --test lib/admin-performance-guard.test.mjs
```

Expected: PASS

- [ ] **Step 2: Check diagnostics**

```text
Get diagnostics for:
- file:///Users/zhao/项目/vinext/app/admin/loading.tsx
```

Expected: no diagnostics

- [ ] **Step 3: Commit**

```bash
git add app/admin/loading.tsx lib/admin-performance-guard.test.mjs
git commit -m "test: cover admin content loading state"
```
