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

  it("writes only true worker secrets and skips Notion data source ids", async () => {
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

    expect(setWorkerSecretMock).toHaveBeenCalledTimes(2);
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
  });
});
