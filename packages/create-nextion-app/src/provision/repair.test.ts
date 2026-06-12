import { describe, expect, it, vi } from "vitest";
import { defaultProvisionMode } from "./options.js";
import type { Answers } from "../prompt.js";
import type { ProjectContext } from "../project-context.js";
import { runProvisionRepair } from "./repair.js";

const provisionMock = vi.hoisted(() => vi.fn());

vi.mock("./index.js", async () => {
  const actual = await vi.importActual<typeof import("./index.js")>("./index.js");
  return {
    ...actual,
    provision: provisionMock,
  };
});

describe("provision mode defaults", () => {
  it("disables deploy for repair mode", () => {
    expect(defaultProvisionMode("repair").deploy).toBe(false);
  });

  it("enables deploy for create mode", () => {
    expect(defaultProvisionMode("create").deploy).toBe(true);
  });
});

describe("runProvisionRepair", () => {
  it("invokes provision in repair mode", async () => {
    const context: ProjectContext = {
      projectDir: "/tmp/demo",
      metadata: {
        projectKind: "nextion",
        projectName: "demo",
        scaffoldVersion: "0.4.10",
        defaultLocale: "en",
        supportedLocales: ["en"],
        uiPreset: "site",
        nextionSource: "^0.1.2",
        contentSource: {
          id: "blog",
          title: "Blog",
          fields: [{ key: "title", notionName: "Name" }],
        },
      },
    };
    const answers: Answers = {
      projectName: "demo",
      targetDir: "./demo",
      defaultLocale: "en",
      supportedLocales: ["en"],
      nextionSource: "^0.1.2",
      uiPreset: "site",
      contentSource: {
        id: "blog",
        title: "Blog",
        fields: [{ key: "title", notionName: "Name" }],
      },
      adminEmail: "admin@example.com",
      adminPassword: "ChangeMe1234",
      notionParentPage: "",
      notionSeedCount: 3,
    };
    provisionMock.mockResolvedValueOnce({ deploy: { skipped: true } });

    await runProvisionRepair(context, answers);

    expect(provisionMock).toHaveBeenCalledWith(
      answers,
      "/tmp/demo",
      expect.objectContaining({
        interactive: false,
        mode: expect.objectContaining({ name: "repair", deploy: false }),
      })
    );
  });
});
