// Stub. Replaced in Phase 5.
export function createFoundationWorker(_options: unknown) {
  return {
    async fetch(_request: Request, _env: unknown, _ctx: unknown): Promise<Response> {
      return new Response("Not Found", { status: 404 });
    },
  };
}
