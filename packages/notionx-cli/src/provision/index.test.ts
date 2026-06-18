import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WireInputs } from "./wire.js";

const setWorkerSecretMock = vi.hoisted(() => vi.fn());

vi.mock("./cloudflare.js", async () => {
  const actual =
    await vi.importActual<typeof import("./cloudflare.js")>("./cloudflare.js");
  return {
    ...actual,
    setWorkerSecret: setWorkerSecretMock,
  };
});

import { _internal } from "./index.js";

describe("setProvisionedWorkerSecrets", () => {
  beforeEach(() => {
    setWorkerSecretMock.mockReset();
  });

  it("writes all required Notion production secrets when available", async () => {
    const wireInputs: WireInputs = {
      d1DatabaseId: "db-id",
      kvNamespaceId: "kv-id",
      vinextKvNamespaceId: "vinext-kv-id",
      turnstileSecret: "turnstile-secret",
      notionToken: "secret-token",
      notionDataSourceId: "content-ds",
      notionPagesDataSourceId: "pages-ds",
      notionBlocksDataSourceId: "blocks-ds",
      notionSiteSettingsDataSourceId: "settings-ds",
    };

    await expect(
      _internal.setProvisionedWorkerSecrets({
        projectDir: "/tmp/demo",
        wireInputs,
        requireNotionSecrets: true,
      })
    ).resolves.toBe(true);

    expect(setWorkerSecretMock).toHaveBeenCalledTimes(4);
    expect(setWorkerSecretMock).toHaveBeenNthCalledWith(
      1,
      "TURNSTILE_SECRET_KEY",
      "turnstile-secret",
      "/tmp/demo",
      ["turnstile-secret"]
    );
    expect(setWorkerSecretMock).toHaveBeenNthCalledWith(
      2,
      "NOTION_TOKEN",
      "secret-token",
      "/tmp/demo",
      ["secret-token"]
    );
    expect(setWorkerSecretMock).toHaveBeenNthCalledWith(
      3,
      "NOTION_DATA_SOURCE_ID",
      "content-ds",
      "/tmp/demo",
      ["content-ds"]
    );
    expect(setWorkerSecretMock).toHaveBeenNthCalledWith(
      4,
      "NOTION_PAGES_DATA_SOURCE_ID",
      "pages-ds",
      "/tmp/demo",
      ["pages-ds"]
    );
  });

  it("throws when required Notion content ids are missing", async () => {
    const wireInputs: WireInputs = {
      d1DatabaseId: "db-id",
      kvNamespaceId: "kv-id",
      vinextKvNamespaceId: "vinext-kv-id",
      notionToken: "secret-token",
      notionDataSourceId: "",
      notionPagesDataSourceId: "pages-ds",
    };

    await expect(
      _internal.setProvisionedWorkerSecrets({
        projectDir: "/tmp/demo",
        wireInputs,
        requireNotionSecrets: true,
      })
    ).rejects.toThrow(
      "failed to set NOTION_DATA_SOURCE_ID; production content will be empty until this secret is set"
    );
  });
});
