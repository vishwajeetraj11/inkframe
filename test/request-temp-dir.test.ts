import { beforeEach, describe, expect, it, vi } from "vitest";

const tempStorageMock = {
  cleanupPath: vi.fn(),
  createRequestTempDir: vi.fn(),
  pruneStaleTempDirs: vi.fn(),
};

vi.mock("@/server/temp-storage", () => tempStorageMock);

const { withRequestTempDir } = await import("@/server/services/request-temp-dir");

describe("withRequestTempDir", () => {
  beforeEach(() => {
    tempStorageMock.cleanupPath.mockReset();
    tempStorageMock.createRequestTempDir.mockReset();
    tempStorageMock.pruneStaleTempDirs.mockReset();
    tempStorageMock.createRequestTempDir.mockResolvedValue({
      requestId: "req-123",
      requestDir: "/tmp/editor-req-123",
    });
    tempStorageMock.cleanupPath.mockResolvedValue(undefined);
    tempStorageMock.pruneStaleTempDirs.mockResolvedValue(undefined);
  });

  it("cleans up temp directories after success", async () => {
    const result = await withRequestTempDir(async (context) => {
      expect(context).toEqual({
        requestId: "req-123",
        requestDir: "/tmp/editor-req-123",
      });
      return "ok";
    });

    expect(result).toBe("ok");
    expect(tempStorageMock.cleanupPath).toHaveBeenCalledWith("/tmp/editor-req-123");
    expect(tempStorageMock.pruneStaleTempDirs).toHaveBeenCalledTimes(1);
  });

  it("cleans up temp directories after failure", async () => {
    await expect(
      withRequestTempDir(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(tempStorageMock.cleanupPath).toHaveBeenCalledWith("/tmp/editor-req-123");
    expect(tempStorageMock.pruneStaleTempDirs).toHaveBeenCalledTimes(1);
  });
});
