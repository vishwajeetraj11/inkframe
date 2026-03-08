import { beforeEach, describe, expect, it, vi } from "vitest";

const editorExportServiceMock = {
  exportEditorProjectToBuffer: vi.fn(),
};
const textMotionExportServiceMock = {
  exportTextMotionProjectToBuffer: vi.fn(),
};

vi.mock("@/server/services/editor-export-service", () => editorExportServiceMock);
vi.mock("@/server/services/text-motion-export-service", () => textMotionExportServiceMock);

const { POST: exportRoute } = await import("@/app/api/export/route");
const { POST: textMotionExportRoute } = await import("@/app/api/text-motion/export/route");

describe("API route validation", () => {
  beforeEach(() => {
    editorExportServiceMock.exportEditorProjectToBuffer.mockReset();
    textMotionExportServiceMock.exportTextMotionProjectToBuffer.mockReset();
  });

  it("returns 400 for missing editor export payloads", async () => {
    const formData = new FormData();
    const response = await exportRoute(
      new Request("http://localhost/api/export", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Missing project payload.",
    });
    expect(editorExportServiceMock.exportEditorProjectToBuffer).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid text motion export payloads", async () => {
    const response = await textMotionExportRoute(
      new Request("http://localhost/api/text-motion/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ project: { title: "bad" } }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.any(String),
    });
    expect(textMotionExportServiceMock.exportTextMotionProjectToBuffer).not.toHaveBeenCalled();
  });
});
