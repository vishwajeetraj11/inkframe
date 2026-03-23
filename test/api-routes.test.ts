import { createDefaultTextMotionProject } from "@/lib/text-motion/defaults";
import { beforeEach, describe, expect, it, vi } from "vitest";

const editorExportServiceMock = {
  exportEditorProject: vi.fn(),
};
const textMotionExportServiceMock = {
  exportTextMotionProject: vi.fn(),
};

vi.mock("@/server/services/editor-export-service", () => editorExportServiceMock);
vi.mock("@/server/services/text-motion-export-service", () => textMotionExportServiceMock);

const { POST: exportRoute } = await import("@/app/api/export/route");
const { POST: textMotionExportRoute } = await import("@/app/api/text-motion/export/route");

describe("API route validation", () => {
  beforeEach(() => {
    editorExportServiceMock.exportEditorProject.mockReset();
    textMotionExportServiceMock.exportTextMotionProject.mockReset();
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
    expect(editorExportServiceMock.exportEditorProject).not.toHaveBeenCalled();
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
    expect(textMotionExportServiceMock.exportTextMotionProject).not.toHaveBeenCalled();
  });

  it("returns download URLs for vercel-backed text motion exports", async () => {
    textMotionExportServiceMock.exportTextMotionProject.mockResolvedValue({
      kind: "download-url",
      downloadUrl: "https://example.com/text-motion.mp4?download=1",
      filename: "text-motion-reel_9_16.mp4",
    });

    const response = await textMotionExportRoute(
      new Request("http://localhost/api/text-motion/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project: createDefaultTextMotionProject("reel_9_16"),
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({
      downloadUrl: "https://example.com/text-motion.mp4?download=1",
      filename: "text-motion-reel_9_16.mp4",
    });
  });
});
