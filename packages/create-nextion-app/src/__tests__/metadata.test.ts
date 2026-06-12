import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_ANSWERS, type Answers } from "../prompt.js";
import {
  buildScaffoldMetadata,
  parseScaffoldMetadata,
  SCAFFOLD_METADATA_FILE,
} from "../metadata.js";
import { loadProjectContext } from "../project-context.js";

const baseAnswers: Answers = {
  projectName: "demo",
  targetDir: "./demo",
  ...DEFAULT_ANSWERS,
};

describe("scaffold metadata", () => {
  it("builds stable metadata from scaffold answers", () => {
    const metadata = buildScaffoldMetadata(baseAnswers, "0.4.10");
    expect(metadata.scaffoldVersion).toBe("0.4.10");
    expect(metadata.projectName).toBe("demo");
    expect(metadata.contentSource.id).toBe("blog");
    expect(metadata.contentSource.fields).toEqual(baseAnswers.contentSource.fields);
    expect(metadata.uiPreset).toBe("site");
    expect(metadata.projectKind).toBe("nextion");
  });

  it("parses valid metadata JSON", () => {
    const parsed = parseScaffoldMetadata(
      JSON.stringify({
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
      })
    );
    expect(parsed.projectName).toBe("demo");
    expect(parsed.contentSource.title).toBe("Blog");
    expect(parsed.contentSource.fields).toEqual([
      { key: "title", notionName: "Name" },
    ]);
  });

  it("rejects invalid metadata", () => {
    expect(() => parseScaffoldMetadata('{"projectKind":"other"}')).toThrow(
      /nextion metadata/i
    );
  });

  it("exports the metadata filename constant", () => {
    expect(SCAFFOLD_METADATA_FILE).toBe(".nextion/scaffold.json");
  });

  it("loads an existing nextion project from scaffold metadata", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nextion-project-"));
    const metadataDir = path.join(dir, ".nextion");
    await mkdir(metadataDir, { recursive: true });
    await writeFile(
      path.join(metadataDir, "scaffold.json"),
      JSON.stringify(
        {
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
        null,
        2
      ),
      "utf8"
    );

    const context = await loadProjectContext(dir);
    expect(context.projectDir).toBe(dir);
    expect(context.metadata.contentSource.id).toBe("blog");
  });
});
