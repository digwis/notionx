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
export { createNextionWorker } from "./worker/bootstrap";
export { runNextionDoctor } from "./doctor";
export type {
  DoctorFinding,
  RuntimeLike,
  RunNextionDoctorOptions,
  NextionDoctorFindingsReport,
} from "./doctor";
