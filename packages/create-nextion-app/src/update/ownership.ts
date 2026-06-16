import type { ManagedFilesManifest, OwnershipKind } from "../template-contracts.js";

export function classifyFileOwnership(
  filePath: string,
  managedFiles: ManagedFilesManifest
): OwnershipKind | "untracked" {
  if (managedFiles.platformManaged.includes(filePath)) return "platformManaged";
  if (managedFiles.bridge.includes(filePath)) return "bridge";
  if (managedFiles.userOwned.includes(filePath)) return "userOwned";
  return "untracked";
}

export function toUnifiedUpdateRisk(input: {
  filePath: string;
  status: "missing" | "updated" | "unchanged" | "skipped";
  managedFiles: ManagedFilesManifest;
}): "safe" | "review" | "conflict" {
  if (input.status === "missing") return "safe";

  switch (classifyFileOwnership(input.filePath, input.managedFiles)) {
    case "platformManaged":
      return "safe";
    case "bridge":
      return "review";
    case "userOwned":
    case "untracked":
      return "conflict";
  }
}
