// Empty shim for `vinext/shims/request-context` used by vitest only.
// The real implementation is provided at runtime by the starter or by
// the vinext/Next.js server. The vitest tests never execute the code;
// they just need the import to resolve so module loading does not
// error.
export function getRequestExecutionContext() {
  return undefined;
}
