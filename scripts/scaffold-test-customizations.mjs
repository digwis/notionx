import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { SCAFFOLD_TEST_NOTION_RESOURCE_ID } from "./scaffold-test-config.mjs";

export const SCAFFOLD_TEST_CUSTOM_README_MARKER = "## Scaffold Test Defaults";
const SCAFFOLD_TEST_CUSTOM_ENV_MARKER = "# --- Scaffold test defaults ---";

const README_BLOCK = `${SCAFFOLD_TEST_CUSTOM_README_MARKER}

This repository keeps \`apps/scaffold-test\` as the canonical generated reference app for
the default \`blog\` starter.

- Fixed Notion resource id: \`${SCAFFOLD_TEST_NOTION_RESOURCE_ID}\`
- Intended use: wire this id into \`.dev.vars\` as the primary content source
  when you want the shared scaffold-test project to point at the team test workspace

`;

const ENV_BLOCK = `${SCAFFOLD_TEST_CUSTOM_ENV_MARKER}
# Shared repository test resource for \`apps/scaffold-test\`
# Copy this value into \`.dev.vars\` when wiring the default blog content source:
#   NOTION_DATA_SOURCE_ID=${SCAFFOLD_TEST_NOTION_RESOURCE_ID}
`;

export function applyScaffoldTestCustomizationsToText(relPath, content) {
  if (relPath === "README.md") {
    if (content.includes(SCAFFOLD_TEST_CUSTOM_README_MARKER)) {
      return content;
    }
    if (content.startsWith("# scaffold-test\n\n")) {
      return content.replace("# scaffold-test\n\n", `# scaffold-test\n\n${README_BLOCK}`);
    }
    return `${README_BLOCK}${content}`;
  }

  if (relPath === ".dev.vars.example") {
    let next = content;
    if (!next.includes(SCAFFOLD_TEST_CUSTOM_ENV_MARKER)) {
      next = next.replace(
        "NOTION_DATA_SOURCE_ID=\n",
        `NOTION_DATA_SOURCE_ID=\n${ENV_BLOCK}`,
      );
    }
    if (!next.includes(`NOTION_DATA_SOURCE_ID=${SCAFFOLD_TEST_NOTION_RESOURCE_ID}`)) {
      next = next.replace(
        "NOTION_DATA_SOURCE_ID=\n",
        `NOTION_DATA_SOURCE_ID=${SCAFFOLD_TEST_NOTION_RESOURCE_ID}\n`,
      );
    }
    return next;
  }

  return content;
}

export function buildInitialScaffoldTestDevVars(exampleContent) {
  return exampleContent.replace(
    /^NOTION_DATA_SOURCE_ID=.*$/m,
    `NOTION_DATA_SOURCE_ID=${SCAFFOLD_TEST_NOTION_RESOURCE_ID}`,
  );
}

export async function applyScaffoldTestCustomizations(appDir) {
  for (const relPath of ["README.md", ".dev.vars.example"]) {
    const absPath = path.join(appDir, relPath);
    const original = await readFile(absPath, "utf8");
    const customized = applyScaffoldTestCustomizationsToText(relPath, original);
    if (customized !== original) {
      await writeFile(absPath, customized, "utf8");
    }
  }
}
