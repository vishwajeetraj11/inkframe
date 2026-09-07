import { afterEach, describe, expect, it, vi } from "vitest";
import {
  triggerBrowserBlobDownload,
  triggerBrowserTextDownload,
} from "@/lib/export/download";

describe("browser export downloads", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("downloads a blob and revokes its object URL after the click", () => {
    vi.useFakeTimers();
    const blob = new Blob(["timeline"]);
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:inkframe-export");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    triggerBrowserBlobDownload({ blob, filename: "cut.fcpxml" });

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:inkframe-export");
    expect(document.querySelector("a[download='cut.fcpxml']")).not.toBeInTheDocument();
  });

  it("wraps timeline text in a typed blob", () => {
    vi.useFakeTimers();
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:inkframe-edl");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    triggerBrowserTextDownload({
      contents: "TITLE: INKFRAME",
      filename: "cut.edl",
      mimeType: "text/plain;charset=utf-8",
    });

    const generatedBlob = createObjectURL.mock.calls[0]?.[0];
    expect(generatedBlob).toBeInstanceOf(Blob);
    if (!(generatedBlob instanceof Blob)) throw new Error("Expected a Blob download.");
    expect(generatedBlob.type).toBe("text/plain;charset=utf-8");
  });
});
