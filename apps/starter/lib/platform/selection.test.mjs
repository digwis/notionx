import test from "node:test";
import assert from "node:assert/strict";
import {
  getRuntimeAdapter,
  runtimeAdapters,
  runtimeServiceStatus,
} from "./capabilities.ts";
import { currentRuntimeId } from "./selection.ts";
import { createCloudflareRuntimePlatform } from "./runtime.ts";

test("currentRuntimeId is fixed to Cloudflare Workers", () => {
  assert.equal(currentRuntimeId(), "cloudflare-workers");
});

test("runtime capabilities expose only the Cloudflare adapter", () => {
  assert.deepEqual(runtimeAdapters.map((adapter) => adapter.id), [
    "cloudflare-workers",
  ]);
  assert.equal(getRuntimeAdapter("cloudflare-workers")?.status, "active");

  assert.deepEqual(
    runtimeServiceStatus(
      createCloudflareRuntimePlatform(
        {
          DB: {
            prepare() {},
            batch() {},
          },
          ASSETS_BUCKET: {},
          IMAGES: {},
        },
        {
          publicCache: {
            async match() {
              return null;
            },
            async put() {},
            async delete() {
              return true;
            },
          },
        }
      )
    ),
    {
      database: true,
      objectStorage: true,
      imageTransformer: true,
      publicCache: true,
    }
  );
});
