import type { Answers } from "./prompt.js";

export const SCAFFOLD_METADATA_FILE = ".nextion/scaffold.json";

export interface ScaffoldMetadata {
  projectKind: "nextion";
  projectName: string;
  scaffoldVersion: string;
  defaultLocale: string;
  supportedLocales: string[];
  uiPreset: Answers["uiPreset"];
  nextionSource: string;
  contentSource: {
    id: string;
    title: string;
    fields: Answers["contentSource"]["fields"];
  };
}

export function buildScaffoldMetadata(
  answers: Answers,
  scaffoldVersion: string
): ScaffoldMetadata {
  return {
    projectKind: "nextion",
    projectName: answers.projectName,
    scaffoldVersion,
    defaultLocale: answers.defaultLocale,
    supportedLocales: [...answers.supportedLocales],
    uiPreset: answers.uiPreset,
    nextionSource: answers.nextionSource,
    contentSource: {
      id: answers.contentSource.id,
      title: answers.contentSource.title,
      fields: answers.contentSource.fields.map((field) => ({
        key: field.key,
        notionName: field.notionName,
      })),
    },
  };
}

export function parseScaffoldMetadata(raw: string): ScaffoldMetadata {
  const parsed = JSON.parse(raw) as Partial<ScaffoldMetadata>;
  if (
    parsed.projectKind !== "nextion" ||
    typeof parsed.projectName !== "string" ||
    typeof parsed.scaffoldVersion !== "string" ||
    typeof parsed.defaultLocale !== "string" ||
    !Array.isArray(parsed.supportedLocales) ||
    typeof parsed.uiPreset !== "string" ||
    typeof parsed.nextionSource !== "string" ||
    !parsed.contentSource ||
    typeof parsed.contentSource.id !== "string" ||
    typeof parsed.contentSource.title !== "string" ||
    !Array.isArray(parsed.contentSource.fields) ||
    parsed.contentSource.fields.some(
      (field) =>
        !field ||
        typeof field.key !== "string" ||
        typeof field.notionName !== "string"
    )
  ) {
    throw new Error("Invalid Nextion metadata payload");
  }

  return parsed as ScaffoldMetadata;
}
