import { describe, it, expect, vi } from "vitest";
import {
  buildAssetUrl,
  listFiles,
  uploadFile,
  deleteFile,
} from "../../src/storage/r2";

type StorageFake = {
  put: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
};

function makeStorage(): StorageFake {
  return {
    put: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    delete: vi.fn(async () => undefined),
    list: vi.fn(async () => []),
  };
}

async function withPlatformStorage<T>(
  storage: StorageFake | null,
  run: () => Promise<T>
): Promise<T> {
  vi.resetModules();
  vi.doMock("../../src/platform/current", () => ({
    getRuntimePlatform: () => ({
      id: "cloudflare-workers",
      objectStorage: storage,
      imageTransformer: null,
      publicCache: null,
      keyValueCache: null,
      database: null,
    }),
  }));
  try {
    return await run();
  } finally {
    vi.doUnmock("../../src/platform/current");
  }
}

describe("storage/r2 helpers", () => {
  it("builds CDN and files URLs from an R2 key", () => {
    expect(buildAssetUrl("cdn", "uploads/2026-06-09/abc.jpg")).toBe(
      "/api/cdn/uploads/2026-06-09/abc.jpg"
    );
    expect(buildAssetUrl("files", "docs/2026-06-09/manual.pdf")).toBe(
      "/api/files/docs/2026-06-09/manual.pdf"
    );
  });

  it("uploads a file with the right content-type and immutable cache headers", async () => {
    const storage = makeStorage();
    const file = new File(["hello"], "cover.jpg", { type: "image/jpeg" });

    const result = await withPlatformStorage(storage, async () => {
      const mod = await import("../../src/storage/r2");
      return mod.uploadFile(file, "uploads");
    });

    expect(storage.put).toHaveBeenCalledOnce();
    const [key, body, options] = storage.put.mock.calls[0]!;
    expect(key).toMatch(/^uploads\/\d{4}-\d{2}-\d{2}\/[a-f0-9]+\.jpg$/);
    expect(body).toBe(file);
    expect(options).toMatchObject({
      contentType: "image/jpeg",
      cacheControl: "public, max-age=31536000, immutable",
    });
    expect(result).toMatchObject({
      contentType: "image/jpeg",
      size: file.size,
    });
    expect(result.url).toMatch(/^\/api\/cdn\//);
    expect(result.key).toBe(key);
  });

  it("routes non-image uploads through the files endpoint", async () => {
    const storage = makeStorage();
    const file = new File(["data"], "manual.pdf", { type: "application/pdf" });

    const result = await withPlatformStorage(storage, async () => {
      const mod = await import("../../src/storage/r2");
      return mod.uploadFile(file);
    });

    expect(result.url).toMatch(/^\/api\/files\//);
  });

  it("rejects files that are too large", async () => {
    const storage = makeStorage();
    const big = new File([new Uint8Array(8)], "huge.jpg", { type: "image/jpeg" });
    // Override the size to simulate a file over the limit.
    Object.defineProperty(big, "size", { value: 200 * 1024 * 1024 });

    await expect(
      withPlatformStorage(storage, async () => {
        const mod = await import("../../src/storage/r2");
        return mod.uploadFile(big);
      })
    ).rejects.toThrow(/too large/i);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("rejects unsupported MIME types without a matching extension", async () => {
    const storage = makeStorage();
    const file = new File(["x"], "evil.exe", { type: "application/x-msdownload" });

    await expect(
      withPlatformStorage(storage, async () => {
        const mod = await import("../../src/storage/r2");
        return mod.uploadFile(file);
      })
    ).rejects.toThrow(/unsupported/i);
  });

  it("lists files using the storage adapter", async () => {
    const storage = makeStorage();
    storage.list.mockResolvedValueOnce([
      { key: "uploads/2026-06-09/abc.jpg", size: 12, uploaded: new Date("2026-06-09T00:00:00Z") },
    ]);

    const files = await withPlatformStorage(storage, async () => {
      const mod = await import("../../src/storage/r2");
      return mod.listFiles();
    });

    expect(files).toEqual([
      {
        key: "uploads/2026-06-09/abc.jpg",
        size: 12,
        uploaded: "2026-06-09T00:00:00.000Z",
        url: "/api/files/uploads/2026-06-09/abc.jpg",
      },
    ]);
  });

  it("deletes a key from the storage adapter", async () => {
    const storage = makeStorage();
    await withPlatformStorage(storage, async () => {
      const mod = await import("../../src/storage/r2");
      await mod.deleteFile("uploads/2026-06-09/abc.jpg");
    });
    expect(storage.delete).toHaveBeenCalledWith("uploads/2026-06-09/abc.jpg");
  });

  it("returns an empty list and no-op delete when storage is not configured", async () => {
    await withPlatformStorage(null, async () => {
      const mod = await import("../../src/storage/r2");
      await expect(mod.deleteFile("uploads/x")).resolves.toBeUndefined();
      await expect(mod.listFiles()).resolves.toEqual([]);
      await expect(
        mod.uploadFile(new File(["x"], "x.jpg", { type: "image/jpeg" }))
      ).rejects.toThrow(/not configured/i);
    });
  });
});

// Suppress the unused-import lint warning while keeping the symbols imported
// in case individual tests prefer direct calls.
void [buildAssetUrl, listFiles, uploadFile, deleteFile];
