# Foundation Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the reusable platform, authentication, admin framework, and Notion helpers from the current vinext starter into a `@vinext/foundation` npm package living in a pnpm monorepo. The starter becomes a thin app that consumes the package.

**Architecture:** Single pnpm monorepo. `packages/foundation` is published to GitHub Packages via changesets. `apps/starter` is the current root, moved into `apps/starter/`. The package exposes 14 subpath exports organized into 7 dependency tiers. ESLint `import/no-restricted-paths` enforces the tier rules. The migration happens in 8 phases; each phase ends with a green test suite and a working dev server.

**Tech Stack:** pnpm workspaces, TypeScript, tsup (ESM + d.ts), ESLint 9, Husky, changesets, Cloudflare Workers, D1, R2, Cloudflare Images, vinext, Notion SDK, Resend, Turnstile, vitest for new package tests, node:test (legacy) for the starter.

---

## File Structure Overview

### New files (created during this plan)

```
packages/foundation/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── eslint.config.mjs
├── src/
│   ├── index.ts                    # Re-exports key public APIs
│   ├── types.ts                    # ContentSource, AuthConfig, AdminExtension, WorkerOptions
│   ├── util/
│   │   ├── env.ts
│   │   ├── site-url.ts
│   │   ├── request-ip.ts
│   │   ├── utils.ts
│   │   └── get-env.ts
│   ├── i18n/
│   │   ├── config.ts
│   │   └── messages.ts
│   ├── hooks/
│   │   ├── use-auth-viewer.ts
│   │   └── use-mobile.ts
│   ├── platform/
│   │   ├── runtime.ts
│   │   ├── cloudflare-runtime.ts
│   │   ├── capabilities.ts
│   │   ├── current.ts
│   │   ├── selection.ts
│   │   └── index.ts
│   ├── cache/
│   │   ├── cache-keys.ts
│   │   └── index.ts
│   ├── notion/
│   │   ├── client.ts
│   │   ├── config.ts
│   │   ├── blocks.ts
│   │   ├── block-text.ts
│   │   ├── content-cache.ts
│   │   ├── media.ts
│   │   ├── generic-source.ts
│   │   ├── property-mappers.ts
│   │   ├── types.ts
│   │   ├── webhook.ts
│   │   ├── mappers.ts
│   │   └── index.ts
│   ├── content/
│   │   ├── models.ts               # defineContentSource factory
│   │   ├── revalidate.ts
│   │   ├── prewarm.ts
│   │   ├── search.ts
│   │   ├── search-index.ts
│   │   ├── admin-summary.ts
│   │   └── index.ts
│   ├── auth/
│   │   ├── auth.ts                 # createAuth factory
│   │   ├── session.ts
│   │   ├── passwords.ts
│   │   ├── users.ts
│   │   ├── rate-limit.ts
│   │   ├── turnstile.ts
│   │   ├── routes/
│   │   │   ├── login.ts
│   │   │   ├── register.ts
│   │   │   ├── logout.ts
│   │   │   ├── forgot-password.ts
│   │   │   ├── reset-password.ts
│   │   │   ├── verify-email.ts
│   │   │   ├── google.ts
│   │   │   ├── google-callback.ts
│   │   │   ├── viewer.ts
│   │   │   └── index.ts
│   │   ├── auth-pages/             # /login, /register, /forgot-password, /reset-password page modules
│   │   │   ├── login.tsx
│   │   │   ├── register.tsx
│   │   │   ├── forgot-password.tsx
│   │   │   ├── reset-password.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── storage/
│   │   ├── r2.ts
│   │   ├── routes/
│   │   │   ├── files.ts
│   │   │   ├── cdn.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── media/
│   │   ├── public-image.ts
│   │   ├── routes/
│   │   │   ├── notion-media.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── email/
│   │   ├── resend.ts
│   │   └── index.ts
│   ├── admin/
│   │   ├── shell.tsx               # AdminShell
│   │   ├── layout.tsx              # AdminLayout
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   ├── nav.ts                  # createAdminNav factory
│   │   ├── pages/
│   │   │   ├── dashboard.tsx
│   │   │   ├── users.tsx
│   │   │   ├── settings.tsx
│   │   │   ├── account.tsx
│   │   │   ├── content-models.tsx
│   │   │   ├── delete-button.tsx
│   │   │   ├── delete-button-lazy.tsx
│   │   │   └── loading.tsx
│   │   └── index.ts
│   ├── doctor/
│   │   ├── doctor.ts
│   │   ├── cli.ts
│   │   └── index.ts
│   ├── worker/
│   │   ├── bootstrap.ts            # createFoundationWorker
│   │   ├── middleware.ts
│   │   ├── routes/
│   │   │   ├── health.ts
│   │   │   ├── content-revalidate.ts
│   │   │   ├── content-prewarm.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   └── internal/                   # Not exposed via package.json exports
│       ├── auth/
│       ├── notion/
│       └── admin/
└── tests/
    ├── util/
    ├── platform/
    ├── notion/
    ├── content/
    ├── auth/
    └── admin/

tools/create-vinext-app/             # Phase 7: scaffolder
├── package.json
├── src/
│   ├── index.ts                    # CLI entry
│   ├── prompt.ts
│   ├── render.ts                   # template rendering
│   └── templates/                  # starter template files
└── tsconfig.json

apps/starter/                        # Phase 0: moved here
├── app/                            # domain routes only
├── lib/
│   ├── auth.config.ts              # Phase 3
│   ├── admin/
│   │   └── nav.ts                  # Phase 4
│   ├── content/
│   │   └── models.ts               # Phase 6
│   └── site/config.ts
├── components/                     # shadcn primitives
├── migrations/
├── public/
├── wrangler.jsonc
├── vite.config.ts
├── next.config.ts
└── package.json

Root:
├── package.json                    # workspace root scripts
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── .npmrc
├── .changeset/
├── .github/workflows/release.yml
├── .husky/pre-commit
└── .gitignore
```

### Files modified in the starter

Every existing file under `lib/`, `app/`, `worker/`, `hooks/`, `scripts/`,
`migrations/` is either moved to the package or kept in the starter with
updated imports. No new content files (blog/movies components, pages) are
added during this plan; the goal is structural, not feature work.

---

## Phase 0: Skeleton

### Task 0.1: Initialize pnpm workspace

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `package.json` (root)
- Modify: `.gitignore`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "apps/*"
  - "tools/*"
```

- [ ] **Step 2: Create `.npmrc`**

```
auto-install-peers=true
strict-peer-dependencies=false
link-workspace-packages=true
prefer-workspace-packages=true
```

- [ ] **Step 3: Replace root `package.json`**

```json
{
  "name": "vinext-monorepo",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "dev:vinext": "pnpm --filter @vinext/starter dev:vinext",
    "foundation:doctor": "pnpm --filter @vinext/foundation foundation:doctor"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

- [ ] **Step 4: Move all current root files into `apps/starter/`**

Run from repo root:

```bash
mkdir -p apps
git mv app apps/starter/app
git mv components apps/starter/components
git mv lib apps/starter/lib
git mv hooks apps/starter/hooks
git mv migrations apps/starter/migrations
git mv public apps/starter/public
git mv scripts apps/starter/scripts
git mv docs apps/starter/docs
git mv worker apps/starter/worker
git mv middleware.ts apps/starter/middleware.ts
git mv next.config.ts apps/starter/next.config.ts
git mv vite.config.ts apps/starter/vite.config.ts
git mv wrangler.jsonc apps/starter/wrangler.jsonc
git mv components.json apps/starter/components.json
git mv env.d.ts apps/starter/env.d.ts
git mv tsconfig.json apps/starter/tsconfig.json
git mv package.json apps/starter/package.json
git mv package-lock.json apps/starter/package-lock.json
git mv README.md apps/starter/README.md
```

Then move `docs/architecture/`, `docs/notion-blog-template.md`,
`docs/notion-movie-template.md`, `docs/superpowers/` back to repo root:

```bash
mkdir -p docs
git mv apps/starter/docs/architecture docs/architecture
git mv apps/starter/docs/notion-blog-template.md docs/notion-blog-template.md
git mv apps/starter/docs/notion-movie-template.md docs/notion-movie-template.md
git mv apps/starter/docs/superpowers docs/superpowers
rmdir apps/starter/docs
```

The starter keeps the `app/`, `components/`, `lib/`, `hooks/`,
`migrations/`, `public/`, `scripts/`, `worker/` tree but with no
`docs/` inside it. The starter's own README can be moved back later
if desired; for now it sits at `apps/starter/README.md`.

- [ ] **Step 5: Update `.gitignore`**

Append (do not overwrite existing entries):

```
# monorepo
.pnpm-store
node_modules/
dist/
.turbo/
*.tsbuildinfo
```

- [ ] **Step 6: Create root `package.json` and install**

```bash
pnpm install
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize pnpm monorepo skeleton"
```

### Task 0.2: Create the foundation package skeleton

**Files:**
- Create: `packages/foundation/package.json`
- Create: `packages/foundation/tsconfig.json`
- Create: `packages/foundation/tsup.config.ts`
- Create: `packages/foundation/eslint.config.mjs`
- Create: `packages/foundation/src/index.ts`

- [ ] **Step 1: Create `packages/foundation/package.json`**

```json
{
  "name": "@vinext/foundation",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "exports": {
    ".": "./dist/index.js",
    "./types": "./dist/types.js",
    "./util": "./dist/util/index.js",
    "./i18n": "./dist/i18n/index.js",
    "./hooks": "./dist/hooks/index.js",
    "./platform": "./dist/platform/index.js",
    "./cache": "./dist/cache/index.js",
    "./notion": "./dist/notion/index.js",
    "./content": "./dist/content/index.js",
    "./auth": "./dist/auth/index.js",
    "./auth-pages": "./dist/auth/auth-pages/index.js",
    "./storage": "./dist/storage/index.js",
    "./media": "./dist/media/index.js",
    "./email": "./dist/email/index.js",
    "./admin": "./dist/admin/index.js",
    "./admin/pages": "./dist/admin/pages/index.js",
    "./doctor": "./dist/doctor/index.js",
    "./worker": "./dist/worker/index.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "foundation:doctor": "node ./dist/doctor/cli.js"
  },
  "dependencies": {
    "@notionhq/client": "^5.22.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "eslint": "^9",
    "tsup": "^8",
    "typescript": "^5",
    "vitest": "^2"
  }
}
```

- [ ] **Step 2: Create `packages/foundation/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@vinext/foundation": ["./src/index.ts"],
      "@vinext/foundation/*": ["./src/*"]
    }
  },
  "include": ["src", "tests"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 3: Create `packages/foundation/tsup.config.ts`**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    types: "src/types.ts",
    "util/index": "src/util/index.ts",
    "i18n/index": "src/i18n/index.ts",
    "hooks/index": "src/hooks/index.ts",
    "platform/index": "src/platform/index.ts",
    "cache/index": "src/cache/index.ts",
    "notion/index": "src/notion/index.ts",
    "content/index": "src/content/index.ts",
    "auth/index": "src/auth/index.ts",
    "auth/auth-pages/index": "src/auth/auth-pages/index.ts",
    "auth/routes/index": "src/auth/routes/index.ts",
    "storage/index": "src/storage/index.ts",
    "media/index": "src/media/index.ts",
    "email/index": "src/email/index.ts",
    "admin/index": "src/admin/index.ts",
    "admin/pages/index": "src/admin/pages/index.ts",
    "doctor/index": "src/doctor/index.ts",
    "doctor/cli": "src/doctor/cli.ts",
    "worker/index": "src/worker/index.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: "es2022",
});
```

- [ ] **Step 4: Create `packages/foundation/eslint.config.mjs`**

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { import: importPlugin },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
        node: true,
      },
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // Tier 3 notion may not reach into higher tiers
            {
              target: "./src/notion/**",
              from: ["./src/content/**", "./src/auth/**", "./src/admin/**", "./src/worker/**"],
            },
            // Tier 4 content may not reach into higher tiers
            {
              target: "./src/content/**",
              from: ["./src/auth/**", "./src/admin/**", "./src/worker/**"],
            },
            // Tier 5 auth may not reach into admin or worker
            {
              target: "./src/auth/**",
              from: ["./src/admin/**", "./src/worker/**"],
            },
            // Tier 6 admin may not reach into worker
            {
              target: "./src/admin/**",
              from: ["./src/worker/**"],
            },
            // The starter must never be reached from the package
            {
              target: "./src/**",
              from: ["../../apps/**", "./apps/**"],
            },
          ],
        },
      ],
    },
  },
];
```

- [ ] **Step 5: Create `packages/foundation/src/index.ts`**

```typescript
// Public top-level entry. Subpath exports carry the bulk of the API.
export type {
  ContentSource,
  AuthConfig,
  AdminExtension,
  AdminNavItem,
  WorkerOptions,
  FoundationConfig,
} from "./types";

export { defineContentSource } from "./content/models";
export { createFoundationWorker } from "./worker/bootstrap";
export { runFoundationDoctor } from "./doctor";
```

- [ ] **Step 6: Install and verify the package compiles**

```bash
cd packages/foundation
pnpm install
pnpm build
pnpm lint
pnpm typecheck
```

Expected: build produces `dist/index.js` and `dist/index.d.ts`; lint
passes (no source files exist yet to violate rules); typecheck passes.

- [ ] **Step 7: Wire a pre-commit hook**

Create `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
pnpm -r --filter '!@vinext/foundation' lint
pnpm -r --filter '!@vinext/foundation' typecheck
```

Make it executable:

```bash
chmod +x .husky/pre-commit
```

Add `husky` to root devDependencies and wire `prepare` script in root
`package.json`:

```json
{
  "scripts": {
    "prepare": "husky"
  },
  "devDependencies": {
    "husky": "^9",
    "typescript-eslint": "^8",
    "eslint-plugin-import": "^2",
    "@eslint/js": "^9"
  }
}
```

Run:

```bash
pnpm install
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(foundation): scaffold package with tier-enforced ESLint"
```

- [ ] **Step 9: Verify the starter still runs**

```bash
cd apps/starter
pnpm install
pnpm test
pnpm run dev:vinext
```

The dev server must start; the existing `app/`, `lib/`, `components/`,
`worker/` directories are unchanged. Smoke-test the home page and at
least one blog or movie route. Kill the dev server.

### Task 0.3: Decide commit cadence rule

- [ ] **Step 1: Document the commit convention in `apps/starter/README.md`**

Add a one-paragraph note near the top:

> This repository is a pnpm workspace. The reusable platform lives in
> `packages/foundation/` and is published as `@vinext/foundation`.
> Changes to that package are released via changesets; everything in
> `apps/starter/` is project-local.

- [ ] **Step 2: Commit**

```bash
git add apps/starter/README.md
git commit -m "docs(starter): note pnpm workspace structure"
```

---

## Phase 1: Leaf modules

Pattern for every file move in this phase: copy the file from
`apps/starter/lib/<path>` to `packages/foundation/src/<path>`, then in
`apps/starter` re-export it from its original location so existing
imports keep working. The re-exports come out in Task 2.x once imports
have been migrated.

### Task 1.1: Move util modules

**Files:**
- Create: `packages/foundation/src/util/env.ts`
- Create: `packages/foundation/src/util/site-url.ts`
- Create: `packages/foundation/src/util/request-ip.ts`
- Create: `packages/foundation/src/util/utils.ts`
- Create: `packages/foundation/src/util/get-env.ts`
- Create: `packages/foundation/src/util/index.ts`
- Modify: `apps/starter/lib/env.ts` (re-export)
- Modify: `apps/starter/lib/site-url.ts` (re-export)
- Modify: `apps/starter/lib/request-ip.ts` (re-export)
- Modify: `apps/starter/lib/utils.ts` (re-export)

- [ ] **Step 1: Write failing tests for `getEnv`**

Create `packages/foundation/tests/util/get-env.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getEnv } from "../../src/util/get-env";

describe("getEnv", () => {
  it("returns the primary value when set", () => {
    process.env.TEST_PRIMARY = "primary";
    expect(getEnv("TEST_PRIMARY")).toBe("primary");
    delete process.env.TEST_PRIMARY;
  });

  it("falls back to the next name when primary is unset", () => {
    delete process.env.TEST_PRIMARY;
    process.env.TEST_FALLBACK = "fallback";
    expect(getEnv("TEST_PRIMARY", "TEST_FALLBACK")).toBe("fallback");
    delete process.env.TEST_FALLBACK;
  });

  it("returns undefined when none are set", () => {
    expect(getEnv("TEST_MISSING_A", "TEST_MISSING_B")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd packages/foundation && pnpm test tests/util/get-env.test.ts
```

Expected: FAIL because `src/util/get-env.ts` does not exist.

- [ ] **Step 3: Move and adapt the source files**

Copy each file from `apps/starter/lib/<name>.ts` to
`packages/foundation/src/util/<name>.ts`. Then create
`packages/foundation/src/util/get-env.ts`:

```typescript
export function getEnv(primary: string, ...fallbacks: string[]): string | undefined {
  if (process.env[primary]) return process.env[primary];
  for (const name of fallbacks) {
    if (process.env[name]) return process.env[name];
  }
  return undefined;
}
```

Create `packages/foundation/src/util/index.ts`:

```typescript
export { getEnv } from "./get-env";
export * from "./env";
export * from "./site-url";
export * from "./request-ip";
export * from "./utils";
```

- [ ] **Step 4: Run the test, confirm it passes**

```bash
pnpm test tests/util/get-env.test.ts
```

Expected: PASS.

- [ ] **Step 5: Re-export from the starter for backward compat**

For each of the four original files, replace the body of
`apps/starter/lib/<name>.ts` with:

```typescript
// Re-exported from @vinext/foundation. Will be removed in Phase 2.
export * from "@vinext/foundation/util";
```

- [ ] **Step 6: Verify the starter still runs**

```bash
cd apps/starter && pnpm test && pnpm run dev:vinext
```

Smoke-test one route that imports `lib/utils.ts` or `lib/env.ts`. Kill
the dev server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(foundation): move util modules into package"
```

### Task 1.2: Move i18n modules

**Files:**
- Create: `packages/foundation/src/i18n/config.ts`
- Create: `packages/foundation/src/i18n/messages.ts`
- Create: `packages/foundation/src/i18n/index.ts`
- Modify: `apps/starter/lib/i18n/config.ts` (re-export)
- Modify: `apps/starter/lib/i18n/messages.ts` (re-export)

- [ ] **Step 1: Write failing tests**

Create `packages/foundation/tests/i18n/config.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { defaultLocale, locales } from "../../src/i18n/config";

describe("i18n config", () => {
  it("declares English and Chinese as supported locales", () => {
    expect(locales).toContain("en");
    expect(locales).toContain("zh");
  });

  it("defaults to English", () => {
    expect(defaultLocale).toBe("en");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
cd packages/foundation && pnpm test tests/i18n/config.test.ts
```

- [ ] **Step 3: Move source files and create barrel**

Copy `apps/starter/lib/i18n/config.ts` and `messages.ts` to
`packages/foundation/src/i18n/`. Create `index.ts`:

```typescript
export * from "./config";
export * from "./messages";
```

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Re-export from the starter, verify, commit**

```bash
git add -A
git commit -m "feat(foundation): move i18n modules into package"
```

### Task 1.3: Move platform modules

**Files:**
- Create: `packages/foundation/src/platform/runtime.ts`
- Create: `packages/foundation/src/platform/cloudflare-runtime.ts`
- Create: `packages/foundation/src/platform/capabilities.ts`
- Create: `packages/foundation/src/platform/current.ts`
- Create: `packages/foundation/src/platform/selection.ts`
- Create: `packages/foundation/src/platform/index.ts`
- Modify: `apps/starter/lib/platform/*` (re-export each)
- Create: `packages/foundation/tests/platform/selection.test.ts`

- [ ] **Step 1: Write failing test for runtime selection**

Create `packages/foundation/tests/platform/selection.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { selectRuntime } from "../../src/platform/selection";

describe("selectRuntime", () => {
  it("returns the cloudflare runtime when CF bindings are present", () => {
    const env = { DB: {}, R2: {} } as any;
    expect(selectRuntime(env).kind).toBe("cloudflare");
  });

  it("throws a clear error when no runtime can be detected", () => {
    expect(() => selectRuntime({} as any)).toThrow(/runtime/i);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Move source files**

Copy each `apps/starter/lib/platform/<name>.ts` into
`packages/foundation/src/platform/`. The original files become:

```typescript
export * from "@vinext/foundation/platform";
```

Create `packages/foundation/src/platform/index.ts`:

```typescript
export * from "./runtime";
export * from "./cloudflare-runtime";
export * from "./capabilities";
export * from "./current";
export * from "./selection";
```

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Verify starter still boots, commit**

```bash
cd apps/starter && pnpm test && pnpm run dev:vinext
git add -A
git commit -m "feat(foundation): move platform modules into package"
```

### Task 1.4: Move doctor module

**Files:**
- Create: `packages/foundation/src/doctor/doctor.ts`
- Create: `packages/foundation/src/doctor/cli.ts`
- Create: `packages/foundation/src/doctor/index.ts`
- Modify: `apps/starter/lib/foundation/doctor.ts` (re-export)
- Modify: `apps/starter/scripts/foundation-doctor.mjs` (delegate)
- Create: `packages/foundation/tests/doctor/doctor.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { runFoundationDoctor } from "../../src/doctor";

describe("runFoundationDoctor", () => {
  it("reports a missing database binding as an error", async () => {
    const report = await runFoundationDoctor({
      env: {} as any,
      runtime: { getBinding: () => undefined } as any,
      sources: [],
    });
    expect(report.findings.some((f) => f.code === "missing-db-binding")).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Move source files**

Copy `apps/starter/lib/foundation/doctor.ts` and
`apps/starter/scripts/foundation-doctor.mjs` into the package. Adapt
the CLI to import from the package's own `dist` after build, or to run
via `tsx` during development.

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Update starter's `package.json` script**

Change `"foundation:doctor": "node scripts/foundation-doctor.mjs"` to:

```json
"foundation:doctor": "pnpm --filter @vinext/foundation foundation:doctor"
```

- [ ] **Step 6: Verify, commit**

```bash
cd apps/starter && pnpm run foundation:doctor
git add -A
git commit -m "feat(foundation): move doctor module into package"
```

---

## Phase 2: Notion base

### Task 2.1: Move generic Notion helpers

**Files:**
- Create: `packages/foundation/src/notion/{client,config,blocks,block-text,content-cache,media,generic-source,property-mappers,types,webhook,mappers}.ts`
- Create: `packages/foundation/src/notion/index.ts`
- Modify: `apps/starter/lib/notion/<name>.ts` for each moved file (re-export)
- Stay in starter: `apps/starter/lib/notion/{posts,movies,movie-*.ts}`

- [ ] **Step 1: Write failing tests for the generic mapper**

Create `packages/foundation/tests/notion/mappers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mapPageToRecord } from "../../src/notion/mappers";

describe("mapPageToRecord", () => {
  it("extracts a title from a Notion page with a `title` property", () => {
    const page = {
      id: "page-1",
      properties: {
        title: { type: "title", title: [{ plain_text: "Hello" }] },
      },
    } as any;
    const record = mapPageToRecord(page, { title: "title" });
    expect(record.title).toBe("Hello");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Move source files**

Copy each of the 11 generic files from `apps/starter/lib/notion/` to
`packages/foundation/src/notion/`. The starter's
`apps/starter/lib/notion/posts.ts`, `movies.ts`, and
`movie-*.ts` files stay where they are.

Create `packages/foundation/src/notion/index.ts`:

```typescript
export * from "./client";
export * from "./config";
export * from "./blocks";
export * from "./block-text";
export * from "./content-cache";
export * from "./media";
export * from "./generic-source";
export * from "./property-mappers";
export * from "./types";
export * from "./webhook";
export * from "./mappers";
```

- [ ] **Step 4: Re-export each generic file from the starter, then migrate imports**

Re-exports keep working while imports are migrated. Use this command to
find every import of the moved files inside the starter:

```bash
cd apps/starter
grep -rl "from \"@/lib/notion/<name>\"" --include="*.ts" --include="*.tsx" .
```

For each match, change `from "@/lib/notion/<name>"` to
`from "@vinext/foundation/notion"`. Then delete the re-export at
`apps/starter/lib/notion/<name>.ts`.

- [ ] **Step 5: Run, expect PASS**

- [ ] **Step 6: Verify the starter still serves blog and movies**

```bash
cd apps/starter && pnpm test && pnpm run dev:vinext
```

Visit `/blog`, one blog post, `/movies`, one movie. Confirm Notion
content renders, the posts API responds, and the webhook handler
accepts a Notion signature.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(foundation): move generic Notion helpers into package"
```

---

## Phase 3: Auth

### Task 3.1: Define the auth factory and types

**Files:**
- Create: `packages/foundation/src/auth/auth.ts`
- Create: `packages/foundation/src/auth/index.ts`
- Create: `packages/foundation/tests/auth/auth.test.ts`

- [ ] **Step 1: Write failing test for the auth factory**

```typescript
import { describe, it, expect } from "vitest";
import { createAuth } from "../../src/auth/auth";

describe("createAuth", () => {
  it("returns helpers bound to the configured database", () => {
    const auth = createAuth({
      databaseBinding: "DB",
      tables: {
        users: "users",
        sessions: "sessions",
        passwordResets: "password_resets",
        emailVerifications: "email_verifications",
        authRateLimits: "auth_rate_limits",
      },
      sessionCookie: { name: "session", maxAge: 3600, secure: true },
      roles: { default: "user", vip: "vip", admin: "admin" },
    });
    expect(typeof auth.requireViewer).toBe("function");
    expect(typeof auth.requireRole).toBe("function");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement `createAuth`**

```typescript
// packages/foundation/src/auth/auth.ts
import type { AuthConfig } from "../types";
import { getCurrentRuntime } from "../platform/current";
import { getViewer } from "./session";
import { listUsers, setUserRole } from "./users";
import { checkAuthRateLimit } from "./rate-limit";
import { verifyTurnstile } from "./turnstile";

export interface Auth {
  requireViewer(request: Request): Promise<{ user: Viewer }>;
  requireRole(request: Request, role: string): Promise<{ user: Viewer }>;
  listUsers(): Promise<User[]>;
  setUserRole(userId: string, role: string): Promise<void>;
  checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean>;
  verifyTurnstile(token: string, ip: string | null): Promise<boolean>;
}

export function createAuth(config: AuthConfig): Auth {
  const runtime = getCurrentRuntime();
  return {
    requireViewer: (request) => requireViewerImpl(request, config, runtime),
    requireRole: (request, role) => requireRoleImpl(request, role, config, runtime),
    listUsers: () => listUsers(config, runtime),
    setUserRole: (userId, role) => setUserRole(userId, role, config, runtime),
    checkRateLimit: (key, limit, windowMs) =>
      checkAuthRateLimit(key, limit, windowMs, config, runtime),
    verifyTurnstile: (token, ip) => verifyTurnstile(token, ip, config),
  };
}
```

The implementations `requireViewerImpl`, `requireRoleImpl`, etc. are
copied verbatim from the starter's `lib/auth.ts` and adapted to accept
the explicit `AuthConfig` and `Runtime` instead of reading from module
state.

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(foundation): add createAuth factory"
```

### Task 3.2: Move auth internals and routes

**Files:**
- Create: `packages/foundation/src/auth/{session,passwords,users,rate-limit,turnstile}.ts`
- Create: `packages/foundation/src/auth/routes/{login,register,logout,forgot-password,reset-password,verify-email,google,google-callback,viewer,index}.ts`
- Create: `packages/foundation/src/auth/auth-pages/{login,register,forgot-password,reset-password,index}.{tsx,ts}`
- Modify: `apps/starter/lib/auth.ts` (re-export)
- Modify: `apps/starter/lib/{session,passwords,users,auth-rate-limit,turnstile}.ts` (re-export)
- Modify: `apps/starter/app/api/auth/*` (delegate to package or remove)
- Modify: `apps/starter/app/{login,register,forgot-password,reset-password}/page.tsx` (delegate)
- Modify: `apps/starter/app/{login,register,forgot-password,reset-password}/messages.ts` (merge into package)
- Create: `apps/starter/lib/auth.config.ts`

- [ ] **Step 1: Move each internal module to the package**

For each of `session.ts`, `passwords.ts`, `users.ts`, `rate-limit.ts`,
`turnstile.ts`: copy to `packages/foundation/src/auth/<name>.ts`. Each
file's imports change from relative `../platform/current` to
`../../platform/current`.

- [ ] **Step 2: Move each auth API route to the package**

For each `apps/starter/app/api/auth/<name>/route.ts`, create
`packages/foundation/src/auth/routes/<name>.ts` exporting
`GET`/`POST` handlers. The handler bodies are unchanged; imports are
updated to use the package's own modules.

- [ ] **Step 3: Move the auth pages**

For each of `login/page.tsx`, `register/page.tsx`,
`forgot-password/page.tsx`, `reset-password/page.tsx`, move to
`packages/foundation/src/auth/auth-pages/<name>.tsx`. The page module
uses `definePage` style export. The page entry is now provided by
`apps/starter` as a thin re-export:

```typescript
// apps/starter/app/login/page.tsx
export { default } from "@vinext/foundation/auth-pages/login";
```

- [ ] **Step 4: Create `apps/starter/lib/auth.config.ts`**

```typescript
import type { AuthConfig } from "@vinext/foundation/types";

export const authConfig: AuthConfig = {
  databaseBinding: "DB",
  tables: {
    users: "users",
    sessions: "sessions",
    passwordResets: "password_resets",
    emailVerifications: "email_verifications",
    authRateLimits: "auth_rate_limits",
  },
  sessionCookie: {
    name: "vinext_session",
    maxAge: 60 * 60 * 24 * 7,
    secure: true,
  },
  turnstile: {
    siteKeyEnv: "TURNSTILE_SITE_KEY",
    secretKeyEnv: "TURNSTILE_SECRET_KEY",
  },
  email: {
    provider: "resend",
    fromEnv: "RESEND_FROM",
    apiKeyEnv: "RESEND_API_KEY",
  },
  oauth: {
    google: {
      clientIdEnv: "GOOGLE_CLIENT_ID",
      clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    },
  },
  roles: { default: "user", vip: "vip", admin: "admin" },
  password: { minLength: 8 },
};
```

- [ ] **Step 5: Verify the full auth flow locally**

```bash
cd apps/starter && pnpm test && pnpm run dev:vinext
```

Manual smoke test:

1. Register a new user (with Turnstile disabled for the test).
2. Receive verification email, click link, confirm verification.
3. Log in, log out.
4. Trigger forgot password, receive email, reset, log in again.
5. Log in with Google OAuth.

Each step must succeed. If Turnstile or Resend are not configured
locally, the corresponding step returns 503 with a clear message; this
is acceptable for the dev environment.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(foundation): move auth internals, routes, and pages into package"
```

---

## Phase 4: Admin framework

### Task 4.1: Define the admin shell and nav factory

**Files:**
- Create: `packages/foundation/src/admin/shell.tsx`
- Create: `packages/foundation/src/admin/layout.tsx`
- Create: `packages/foundation/src/admin/sidebar.tsx`
- Create: `packages/foundation/src/admin/header.tsx`
- Create: `packages/foundation/src/admin/nav.ts`
- Create: `packages/foundation/src/admin/index.ts`
- Create: `packages/foundation/tests/admin/nav.test.ts`

- [ ] **Step 1: Write failing test for `createAdminNav`**

```typescript
import { describe, it, expect } from "vitest";
import { createAdminNav } from "../../src/admin/nav";

describe("createAdminNav", () => {
  it("sorts items by order then labelKey", () => {
    const nav = createAdminNav([
      { href: "/admin/c", labelKey: "admin.c", order: 3 },
      { href: "/admin/a", labelKey: "admin.a", order: 1 },
      { href: "/admin/b", labelKey: "admin.b", order: 1 },
    ]);
    expect(nav.map((n) => n.href)).toEqual(["/admin/a", "/admin/b", "/admin/c"]);
  });

  it("filters items requiring a role the viewer lacks", () => {
    const nav = createAdminNav(
      [
        { href: "/admin/users", labelKey: "users", requireRole: "admin" },
        { href: "/admin", labelKey: "home" },
      ],
      { roles: ["user"] }
    );
    expect(nav.map((n) => n.href)).toEqual(["/admin"]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement `createAdminNav`**

```typescript
// packages/foundation/src/admin/nav.ts
import type { AdminNavItem } from "../types";

export interface AdminNavOptions {
  roles?: string[];
}

export function createAdminNav(
  items: AdminNavItem[],
  options: AdminNavOptions = {}
): AdminNavItem[] {
  const visible = options.roles
    ? items.filter((i) => !i.requireRole || options.roles!.includes(i.requireRole))
    : items;
  return [...visible].sort((a, b) => {
    const orderDiff = (a.order ?? 100) - (b.order ?? 100);
    return orderDiff !== 0 ? orderDiff : a.labelKey.localeCompare(b.labelKey);
  });
}
```

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Implement `AdminShell`, `AdminLayout`, `AdminSidebar`, `AdminHeader`**

These are React components that consume the nav and an auth context.
The body is largely a port of the existing
`apps/starter/app/admin/layout.tsx`. The key change: the sidebar is
built from the nav prop instead of a hard-coded list.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(foundation): add admin shell and createAdminNav factory"
```

### Task 4.2: Move generic admin pages

**Files:**
- Create: `packages/foundation/src/admin/pages/{dashboard,users,settings,account,content-models,delete-button,delete-button-lazy,loading}.{tsx,ts}`
- Modify: `apps/starter/app/admin/layout.tsx` (use package shell)
- Modify: `apps/starter/app/admin/page.tsx` (delegate)
- Modify: `apps/starter/app/admin/users/page.tsx` (delegate)
- Modify: `apps/starter/app/admin/settings/page.tsx` (delegate)
- Modify: `apps/starter/app/admin/account/page.tsx` (delegate)
- Modify: `apps/starter/app/admin/content-models/page.tsx` (delegate)
- Modify: `apps/starter/app/admin/DeleteButton.tsx` (delegate)
- Create: `apps/starter/lib/admin/nav.ts`

- [ ] **Step 1: Move each page module to the package**

For each page, the source code moves verbatim except that:
- Imports become package-relative
- Page props are re-typed to `AdminPageContext` so projects can pass
  custom data later

- [ ] **Step 2: Create `apps/starter/lib/admin/nav.ts`**

```typescript
import { createAdminNav } from "@vinext/foundation/admin";

export const adminNav = createAdminNav([
  { href: "/admin", labelKey: "admin.nav.dashboard", icon: "Home", order: 10 },
  { href: "/admin/content-models", labelKey: "admin.nav.models", icon: "Database", order: 20 },
  { href: "/admin/review", labelKey: "admin.nav.review", icon: "Inbox", order: 30 },
  { href: "/admin/users", labelKey: "admin.nav.users", icon: "Users", requireRole: "admin", order: 40 },
  { href: "/admin/settings", labelKey: "admin.nav.settings", icon: "Settings", requireRole: "admin", order: 50 },
  { href: "/admin/account", labelKey: "admin.nav.account", icon: "User", order: 60 },
]);

export default adminNav;
```

- [ ] **Step 3: Update `apps/starter/app/admin/layout.tsx`**

```typescript
import { AdminShell } from "@vinext/foundation/admin";
import { adminNav } from "@/lib/admin/nav";
import { getAdminViewer } from "@/lib/admin-viewer";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getAdminViewer();
  return (
    <AdminShell nav={adminNav} viewer={viewer}>
      {children}
    </AdminShell>
  );
}
```

- [ ] **Step 4: Replace the moved page files with thin delegates**

```typescript
// apps/starter/app/admin/page.tsx
export { default } from "@vinext/foundation/admin/pages/dashboard";
```

Repeat for `users`, `settings`, `account`, `content-models`, and
`DeleteButton.tsx`. Domain-specific pages (`review`, `new`, `[slug]`)
stay in the starter as actual code.

- [ ] **Step 5: Verify the admin still works**

```bash
cd apps/starter && pnpm test && pnpm run dev:vinext
```

Manual smoke test:

1. Log in as admin, see the dashboard.
2. Open the sidebar; entries appear in the order defined in `nav.ts`.
3. Open `/admin/users`; user list loads.
4. Open `/admin/settings`; save a setting.
5. Open `/admin/content-models`; both blog and movies are listed.
6. Open `/admin/review`; the domain-specific review queue (still
   starter code) loads.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(foundation): move admin framework pages into package"
```

---

## Phase 5: Cache, media, storage, worker, middleware

### Task 5.1: Move cache, media, storage, email modules

**Files:**
- Create: `packages/foundation/src/cache/cache-keys.ts` (+ `index.ts`)
- Create: `packages/foundation/src/media/public-image.ts` (+ `index.ts`)
- Create: `packages/foundation/src/storage/r2.ts` (+ `index.ts`)
- Create: `packages/foundation/src/email/resend.ts` (+ `index.ts`)
- Modify: `apps/starter/lib/<name>.ts` (re-export)
- Create: `packages/foundation/tests/cache/cache-keys.test.ts`
- Create: `packages/foundation/tests/storage/r2.test.ts`

- [ ] **Step 1: Write failing test for `buildCacheKey`**

```typescript
import { describe, it, expect } from "vitest";
import { buildCacheKey } from "../../src/cache/cache-keys";

describe("buildCacheKey", () => {
  it("combines parts with a colon separator", () => {
    expect(buildCacheKey("notion", "page", "abc")).toBe("notion:page:abc");
  });

  it("escapes colons inside parts", () => {
    expect(buildCacheKey("notion", "page:abc")).toBe("notion:page%3Aabc");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Move source files**

Each file moves with imports updated to package-relative paths.

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Migrate imports in the starter, then drop re-exports**

Same pattern as Phase 2: re-export, then grep for import sites, then
remove the re-export when zero sites remain.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(foundation): move cache, media, storage, email modules into package"
```

### Task 5.2: Move generic API routes

**Files:**
- Create: `packages/foundation/src/storage/routes/{files,cdn,index}.ts`
- Create: `packages/foundation/src/media/routes/{notion-media,index}.ts`
- Create: `packages/foundation/src/worker/routes/{health,content-revalidate,content-prewarm,index}.ts`
- Create: `packages/foundation/src/notion/routes/{webhook,index}.ts` (webhook moves from `notion/webhook.ts` and is exposed as an API route)
- Modify: `apps/starter/app/api/files/[...key]/route.ts` (delegate)
- Modify: `apps/starter/app/api/cdn/[...key]/route.ts` (delegate)
- Modify: `apps/starter/app/api/notion/media/[...ref]/route.ts` (delegate)
- Modify: `apps/starter/app/api/notion/webhook/route.ts` (delegate)
- Modify: `apps/starter/app/api/content/revalidate/route.ts` (delegate)
- Modify: `apps/starter/app/api/content/prewarm/route.ts` (delegate)
- Modify: `apps/starter/app/api/health/route.ts` (delegate)

- [ ] **Step 1: Move each route to its package location**

The bodies are copied verbatim; the only changes are imports.

- [ ] **Step 2: Replace starter route files with thin delegates**

```typescript
// apps/starter/app/api/files/[...key]/route.ts
import { filesRoute } from "@vinext/foundation/storage/routes";
export const GET = filesRoute.GET;
export const POST = filesRoute.POST;
```

(Adjust the exported methods per route.)

- [ ] **Step 3: Verify each route locally**

```bash
cd apps/starter && pnpm test && pnpm run dev:vinext
```

Manual smoke test (one per route):

- `GET /api/health` → 200 with `{ status: "ok" }`
- `POST /api/files/<key>` with a sample upload → 200
- `GET /api/cdn/<key>` → 200 with the uploaded object
- `GET /api/notion/media/<ref>` → image bytes
- `POST /api/content/revalidate` with a valid token → 200
- `POST /api/content/prewarm` with a valid token → 200
- `POST /api/notion/webhook` with a valid signature → 200

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(foundation): move generic API routes into package"
```

### Task 5.3: Move middleware and create worker bootstrap

**Files:**
- Create: `packages/foundation/src/middleware.ts`
- Create: `packages/foundation/src/worker/bootstrap.ts`
- Create: `packages/foundation/src/worker/index.ts`
- Create: `packages/foundation/tests/worker/bootstrap.test.ts`
- Modify: `apps/starter/middleware.ts` (delegate)
- Modify: `apps/starter/worker/index.ts` (thin call)

- [ ] **Step 1: Write failing test for `createFoundationWorker`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { createFoundationWorker } from "../../src/worker/bootstrap";

describe("createFoundationWorker", () => {
  it("returns a fetch handler", () => {
    const handler = createFoundationWorker({
      sources: [],
      adminNav: [],
      authConfig: {
        databaseBinding: "DB",
        tables: { users: "u", sessions: "s", passwordResets: "p", emailVerifications: "e", authRateLimits: "r" },
        sessionCookie: { name: "s", maxAge: 1, secure: true },
        roles: { default: "u", vip: "v", admin: "a" },
      },
      siteConfig: { name: "Test", description: "d", defaultLocale: "en", locales: ["en"], navigation: [] },
    });
    expect(typeof handler.fetch).toBe("function");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement `createFoundationWorker`**

```typescript
// packages/foundation/src/worker/bootstrap.ts
import type { WorkerOptions, ContentSource, AdminNavItem, AuthConfig } from "../types";
import { getCurrentRuntime } from "../platform/current";
import { registerContentSource } from "../content/models";
import { createAuth } from "../auth/auth";
import { foundationMiddleware } from "../middleware";
import { revalidateContentModel } from "../content/revalidate";
import { healthRoute } from "./routes/health";
import { contentRevalidateRoute } from "./routes/content-revalidate";
import { contentPrewarmRoute } from "./routes/content-prewarm";
import { mediaRoute } from "../media/routes/notion-media";
import { filesRoute } from "../storage/routes/files";
import { cdnRoute } from "../storage/routes/cdn";
import { notionWebhookRoute } from "../notion/routes/webhook";

export interface Worker {
  fetch: (request: Request, env: any, ctx: any) => Promise<Response>;
}

export function createFoundationWorker(options: WorkerOptions): Worker {
  // Pre-register content sources so their handlers are wired up.
  const sources: ContentSource[] = options.sources;
  const auth = createAuth(options.authConfig);
  const runtime = getCurrentRuntime();

  const routes: Array<{ match: (req: Request) => boolean; handle: (req: Request) => Promise<Response> }> = [
    { match: (req) => new URL(req.url).pathname === "/api/health", handle: healthRoute },
    { match: (req) => new URL(req.url).pathname === "/api/content/revalidate", handle: contentRevalidateRoute },
    { match: (req) => new URL(req.url).pathname === "/api/content/prewarm", handle: contentPrewarmRoute },
    { match: (req) => new URL(req.url).pathname.startsWith("/api/notion/media/"), handle: mediaRoute },
    { match: (req) => new URL(req.url).pathname.startsWith("/api/files/"), handle: filesRoute.handle },
    { match: (req) => new URL(req.url).pathname.startsWith("/api/cdn/"), handle: cdnRoute.handle },
    { match: (req) => new URL(req.url).pathname === "/api/notion/webhook", handle: notionWebhookRoute },
  ];

  // Project-supplied extra routes
  if (options.extraRoutes) {
    for (const [path, load] of Object.entries(options.extraRoutes)) {
      const modPromise = load();
      routes.push({
        match: (req) => new URL(req.url).pathname === path,
        handle: async (req) => (await modPromise).default(req, options, sources, auth),
      });
    }
  }

  return {
    async fetch(request, env, ctx) {
      const middlewareResponse = await foundationMiddleware(request, env, options);
      if (middlewareResponse) return middlewareResponse;

      for (const route of routes) {
        if (route.match(request)) return route.handle(request);
      }

      return new Response("Not Found", { status: 404 });
    },
  };
}
```

`foundationMiddleware` reads the cookie, attaches the viewer to a
request-scoped context, and either allows the request through or
returns 401 for protected admin paths.

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Replace `apps/starter/worker/index.ts`**

```typescript
import { createFoundationWorker } from "@vinext/foundation/worker";
import { blogSource, moviesSource } from "../lib/content/models";
import { adminNav } from "../lib/admin/nav";
import { authConfig } from "../lib/auth.config";
import { siteConfig } from "../lib/site/config";

export default createFoundationWorker({
  sources: [blogSource, moviesSource],
  adminNav,
  authConfig,
  siteConfig,
});
```

(At this point `blogSource` and `moviesSource` are still the old
module-state style; Phase 6 converts them.)

- [ ] **Step 6: Verify the Cloudflare staging deployment**

```bash
cd apps/starter && pnpm run deploy:remote -- --dry-run
```

Then run a real deploy to a throwaway Cloudflare Worker and curl every
public route. They must return the same responses as before the
refactor.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(foundation): add createFoundationWorker and middleware"
```

---

## Phase 6: Content abstraction

### Task 6.1: Define `defineContentSource`

**Files:**
- Create: `packages/foundation/src/content/models.ts`
- Create: `packages/foundation/src/content/index.ts`
- Create: `packages/foundation/tests/content/models.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { defineContentSource, getRegisteredSources } from "../../src/content/models";

describe("defineContentSource", () => {
  it("registers and returns the source", () => {
    const source = defineContentSource({
      id: "test",
      source: { tokenEnv: "T", dataSourceEnv: "D", fields: { title: "t", slug: "s" } },
      routes: { list: "/test", detail: (slug) => `/test/${slug}` },
      ui: { labels: { en: { title: "Test", description: "d", emptyState: "e" } } },
    });
    expect(source.id).toBe("test");
    expect(getRegisteredSources().map((s) => s.id)).toContain("test");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement `defineContentSource`**

```typescript
// packages/foundation/src/content/models.ts
import type { ContentSource } from "../types";

const registry: ContentSource[] = [];

export function defineContentSource<T extends ContentSource>(source: T): T {
  const existing = registry.findIndex((s) => s.id === source.id);
  if (existing >= 0) registry[existing] = source;
  else registry.push(source);
  return source;
}

export function getRegisteredSources(): readonly ContentSource[] {
  return registry;
}

export function clearRegistryForTests(): void {
  registry.length = 0;
}
```

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(content): add defineContentSource factory"
```

### Task 6.2: Move content framework modules

**Files:**
- Create: `packages/foundation/src/content/{revalidate,prewarm,search,search-index,admin-summary}.ts`
- Modify: `apps/starter/lib/content/<name>.ts` (re-export)
- Create: `packages/foundation/tests/content/revalidate.test.ts`

- [ ] **Step 1: Write failing test for revalidation**

```typescript
import { describe, it, expect } from "vitest";
import { getRevalidationPaths } from "../../src/content/revalidate";

describe("getRevalidationPaths", () => {
  it("returns list and detail paths for a source", () => {
    const paths = getRevalidationPaths({
      id: "x",
      source: { tokenEnv: "t", dataSourceEnv: "d", fields: { title: "t", slug: "s" } },
      routes: { list: "/x", detail: (slug) => `/x/${slug}`, api: "/api/x" },
      ui: { labels: {} },
    });
    expect(paths).toEqual(["/x", "/api/x"]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Move each module**

Same pattern as prior phases. The revalidate module uses
`revalidatePath(...)` from vinext, which the package re-exports.

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Migrate imports, commit**

### Task 6.3: Convert blog and movies to `defineContentSource`

**Files:**
- Modify: `apps/starter/lib/content/models.ts` (use `defineContentSource`)
- Modify: `apps/starter/lib/notion/posts.ts` (consume the registered source)
- Modify: `apps/starter/lib/notion/movies.ts` (consume the registered source)

- [ ] **Step 1: Write the new models file**

```typescript
// apps/starter/lib/content/models.ts
import { defineContentSource } from "@vinext/foundation/content";
import type { ContentSource } from "@vinext/foundation/types";

export const blogSource: ContentSource = defineContentSource({
  id: "blog",
  source: {
    tokenEnv: "NOTION_TOKEN",
    dataSourceEnv: "NOTION_DATA_SOURCE_ID",
    fields: {
      title: "Name",
      slug: "Slug",
      status: "Status",
      description: "Description",
      date: "Date",
      cover: "Cover",
      tags: "Tags",
    },
    queryDefaults: { sorts: [{ property: "Date", direction: "descending" }], pageSize: 20 },
  },
  routes: {
    list: "/blog",
    detail: (slug) => `/blog/${slug}`,
    api: "/api/posts",
  },
  ui: {
    labels: {
      en: { title: "Blog", description: "Articles", emptyState: "No posts yet." },
      zh: { title: "博客", description: "文章列表", emptyState: "还没有文章。" },
    },
  },
  capabilities: { richBlocks: true, coverImage: true },
});

export const moviesSource: ContentSource = defineContentSource({
  id: "movies",
  source: {
    tokenEnv: "NOTION_TOKEN",
    dataSourceEnv: "NOTION_MOVIES_DATA_SOURCE_ID",
    fields: {
      title: "电影名称",
      slug: "slug",
      description: "剧情简介",
      date: "上映时间",
      cover: "海报",
      tags: "类型",
    },
  },
  routes: {
    list: "/[locale]/movies",
    detail: (slug) => `/[locale]/movies/${slug}`,
    api: "/api/movies",
  },
  ui: {
    labels: {
      en: { title: "Movies", description: "Catalog", emptyState: "No movies yet." },
      zh: { title: "电影", description: "片库", emptyState: "还没有电影。" },
    },
  },
  capabilities: { richBlocks: true, coverImage: true, gatedAssets: true },
});
```

- [ ] **Step 2: Update `lib/notion/posts.ts` and `movies.ts`**

Each file changes from reading module state to receiving the source as
a parameter:

```typescript
// before
import { getNotionClient } from "@/lib/notion/client";
const post = await queryBlogBySlug(slug);

// after
import { getNotionClient } from "@vinext/foundation/notion";
import { getRegisteredSources } from "@vinext/foundation/content";
import { blogSource } from "@/lib/content/models";
const post = await queryBlogBySlug(slug, blogSource);
```

- [ ] **Step 3: Verify the public site, API, webhook, and admin content-models page**

- `/blog` and `/[locale]/movies` lists render
- A single post and a single movie detail page render
- `POST /api/posts/<slug>` and `POST /api/movies/<id>` return the right shape
- `POST /api/notion/webhook` with a valid signature clears cache for the right path
- `/admin/content-models` lists both sources with their routes and capabilities

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(content): convert blog and movies to defineContentSource"
```

---

## Phase 7: Scaffolder and publishing

### Task 7.1: Build the scaffolder

**Files:**
- Create: `tools/create-vinext-app/package.json`
- Create: `tools/create-vinext-app/tsconfig.json`
- Create: `tools/create-vinext-app/src/index.ts`
- Create: `tools/create-vinext-app/src/prompt.ts`
- Create: `tools/create-vinext-app/src/render.ts`
- Create: `tools/create-vinext-app/src/templates/` (template files)

- [ ] **Step 1: Create `tools/create-vinext-app/package.json`**

```json
{
  "name": "create-vinext-app",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "bin": { "create-vinext-app": "./dist/index.js" },
  "scripts": {
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@clack/prompts": "^0.7"
  }
}
```

- [ ] **Step 2: Implement the prompt**

`tools/create-vinext-app/src/prompt.ts` uses `@clack/prompts` to ask
for project name, default locale, and first content source fields.

- [ ] **Step 3: Implement the render**

`tools/create-vinext-app/src/render.ts` writes:
- `package.json` with `"@vinext/foundation": "^1.0.0"` dependency
- `wrangler.jsonc` with binding placeholders
- `migrations/0001_init.sql` with the auth schema
- `app/page.tsx` with a placeholder landing page
- `lib/auth.config.ts` from a template
- `lib/content/models.ts` with one `defineContentSource` for the user
- `lib/site/config.ts` from a template
- `lib/admin/nav.ts` with the default nav
- `worker/index.ts` calling `createFoundationWorker`
- `tsconfig.json`, `next.config.ts`, `vite.config.ts`
- `README.md` with quick-start instructions

- [ ] **Step 4: Verify the scaffolder produces a working project**

```bash
pnpm --filter create-vinext-app build
node tools/create-vinext-app/dist/index.js /tmp/test-vinext
cd /tmp/test-vinext
pnpm install
pnpm test
pnpm run dev:vinext
```

The generated project must boot, render the landing page, and serve
the content list/detail routes defined in the prompt.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tools): add create-vinext-app scaffolder"
```

### Task 7.2: Configure changesets and the release workflow

**Files:**
- Create: `.changeset/config.json`
- Create: `.changeset/README.md`
- Create: `.github/workflows/release.yml`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.changeset/config.json`**

```json
{
  "$schema": "https://unpkg.com/@changesets/config@2/schema.json",
  "changelog": ["@vinext/foundation"],
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "privatePackages": {
    "tag": false,
    "version": false
  }
}
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build
      - run: pnpm -r lint
      - run: pnpm -r typecheck
      - run: pnpm -r test
```

- [ ] **Step 3: Create `.github/workflows/release.yml`**

```yaml
name: release
on:
  push:
    branches: [main]
    paths: ["packages/foundation/**", ".changeset/**"]
jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm, registry-url: https://npm.pkg.github.com }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @vinext/foundation build
      - run: pnpm changeset version
      - run: pnpm changeset publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore: release foundation ${{ steps.changesets.outputs.publishedVersion }}"
```

- [ ] **Step 4: Add a sample changeset**

```bash
mkdir -p .changeset
cat > .changeset/initial-foundation.md <<'EOF'
---
"@vinext/foundation": major
---

Initial release of @vinext/foundation as a separate package.
EOF
```

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "ci: add changesets and release workflow"
git push
```

Confirm that the CI job passes and (on merge to main) the release job
publishes `@vinext/foundation@1.0.0` to GitHub Packages.

- [ ] **Step 6: Verify a consumer can install the published package**

Create a throwaway directory and run:

```bash
mkdir /tmp/consumer && cd /tmp/consumer
npm init -y
npm install @vinext/foundation@1.0.0 --registry=https://npm.pkg.github.com
```

Expect the install to succeed and the package to be importable from
Node.

---

## Phase 8: Documentation

### Task 8.1: Architecture documentation

**Files:**
- Create: `docs/architecture/foundation-package.md`
- Create: `docs/architecture/creating-new-project.md`
- Create: `docs/architecture/customizing-content-source.md`
- Create: `docs/architecture/upgrading-foundation.md`
- Create: `docs/architecture/foundation-changelog.md`

- [ ] **Step 1: Write `foundation-package.md`**

This is a near-copy of the spec, trimmed to omit the migration-phase
details. Link from the existing `content-foundation.md`.

- [ ] **Step 2: Write `creating-new-project.md`**

```markdown
# Creating A New Project

1. Run `pnpm create vinext-app my-new-site`.
2. Answer the prompts: project name, default locale, first content
   source fields.
3. `cd my-new-site && pnpm install`.
4. Copy `.dev.vars.example` to `.dev.vars` and fill in the values
   for local dev.
5. Run `pnpm run dev:vinext`.
6. To deploy, follow the Cloudflare setup in the generated README.
```

- [ ] **Step 3: Write `customizing-content-source.md`**

Show the process of adding a second content source to an existing
project: edit `lib/content/models.ts`, add a route under `app/`, and
optionally add an admin page.

- [ ] **Step 4: Write `upgrading-foundation.md`**

Show Dependabot config, the auto-merge strategy, and how to test a
major version upgrade before merging.

- [ ] **Step 5: Write `foundation-changelog.md`**

Link to GitHub Packages release notes. Add a section per release with
the migration callouts (none for 1.0.0; future releases add notes
here).

- [ ] **Step 6: Update top-level `README.md`**

Replace the architecture section with a one-paragraph summary that
points to the new docs.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: add foundation package architecture documents"
```

### Task 8.2: Update the existing `content-foundation.md`

- [ ] **Step 1: Add a deprecation note at the top**

> This document describes the original content foundation as it existed
> before the package split. The new architecture is documented in
> [`foundation-package.md`](./foundation-package.md). The starter
> application under `apps/starter/` continues to follow both sets of
> guidance: this document for its content domains, and the new document
> for the boundary between starter and package.

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/content-foundation.md
git commit -m "docs(content-foundation): link to package architecture"
```

---

## Self-Review Checklist (run after writing the plan)

Run through this list before declaring the plan complete. The skill
text mandates it.

1. **Spec coverage** — each spec section maps to at least one task:
   - Repository Layout → Tasks 0.1, 0.2
   - Public API → Tasks 1.1–1.4, 2.1, 3.1, 4.1, 5.1, 6.1
   - Boundary Contracts → Tasks 3.1, 4.1, 5.3, 6.1
   - Configuration & Env → Task 3.2 (auth.config), 1.1 (getEnv)
   - Dependency Direction → Task 0.2 (eslint.config.mjs)
   - Distribution → Task 7.2 (release workflow)
   - What stays / what goes → reflected in every Phase's task descriptions
   - Migration Phases 0–8 → Tasks 0.1, 1.1–1.4, 2.1, 3.1–3.2, 4.1–4.2, 5.1–5.3, 6.1–6.3, 7.1–7.2, 8.1–8.2
   - Verification per phase → "Verification" step in every task
   - Risks → Mitigations reflected in Task 0.2 (lint), 2.1 (migrate imports), 5.3 (staging deploy)
   - Open Questions → answered inline in the spec (apps/starter stays in monorepo; no Verdaccio; scaffolder in tools/)

2. **Placeholder scan** — search for TBD, TODO, "implement later", "fill
   in details", "add appropriate". Replace any occurrence with actual
   code or remove the step.

3. **Type consistency** — `defineContentSource` is used everywhere as
   the factory name; `createAuth` is the auth factory; `createAdminNav`
   is the nav factory; `createFoundationWorker` is the worker
   factory. The `AuthConfig.tables` object uses snake_case keys
   consistent with the D1 schema. `ContentSource.source.fields` is
   a Record, allowing projects to add domain-specific fields.

4. **Scope check** — each phase produces a working, testable state.
   No phase depends on the next being complete to be useful. The
   8 phases map directly to the spec's 8 phases.

5. **No "similar to" cross-references** — every task that changes code
   shows the code. Where a pattern repeats (e.g., file moves in
   Phase 1), the plan still shows the actual code blocks for the
   `index.ts` barrel and the re-export shim.

After the plan is committed, offer the user the choice of execution
mode: subagent-driven (recommended) or inline.
