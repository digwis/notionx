export const scaffoldManagedFiles = [
  "package.json",
  "wrangler.jsonc",
  "README.md",
  ".nextion/scaffold.json",
  ".dev.vars.example",
] as const;

export function isScaffoldManagedFile(filePath: string): boolean {
  return scaffoldManagedFiles.includes(
    filePath as (typeof scaffoldManagedFiles)[number]
  );
}
