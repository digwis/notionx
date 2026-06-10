// Stub. Replaced in Phase 1.
export interface DoctorReport {
  findings: Array<{ code: string; message: string; severity: "info" | "warning" | "error" }>;
}

export async function runFoundationDoctor(_options: unknown): Promise<DoctorReport> {
  return { findings: [] };
}
