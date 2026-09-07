// Tests the exact helper emitted by the installer, with deterministic Canvas/GL
// doubles. Actual browser texture sampling remains an integration check.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyColorGradeToPixels, hasColorGrade, legacyVideoFilterToCss } from "../src/lib/editor/color-grading";
import { cloneVideoFilterPreset } from "../src/lib/editor/video-filters";

const installer = readFileSync("scripts/patch-elah-text-motion.mjs", "utf8");
const runtimeStart = installer.indexOf("let scratch;");
const runtimeEnd = installer.indexOf("\n`;", runtimeStart);
if (runtimeStart < 0 || runtimeEnd < 0) throw new Error("Grading runtime anchors missing");
const runtime = installer.slice(runtimeStart, runtimeEnd).replaceAll("export function ", "function ");

class Bitmap {
  width = 1;
  height = 2;
  constructor(public pixels: Uint8ClampedArray) {}
}
class Canvas {
  pixels = new Uint8ClampedArray(8);
  constructor(public width: number, public height: number) {}
  getContext() {
    return {
      filter: "none",
      clearRect: () => this.pixels.fill(0),
      drawImage: (source: Bitmap | Canvas) => { this.pixels = source.pixels.slice(); },
      getImageData: () => ({ data: this.pixels.slice() }),
      putImageData: (image: { data: Uint8ClampedArray }) => { this.pixels = image.data.slice(); },
    };
  }
}
function setup(initialFlip = true) {
  vi.stubGlobal("ImageBitmap", Bitmap);
  vi.stubGlobal("OffscreenCanvas", Canvas);
  const upload = new Function("hasColorGrade", "legacyVideoFilterToCss", "applyColorGradeToPixels",
    runtime + "\nreturn uploadGradedVideo;")(hasColorGrade, legacyVideoFilterToCss, applyColorGradeToPixels);
  let flip = initialFlip;
  const gl = {
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    getParameter: vi.fn(() => flip),
    pixelStorei: vi.fn((_key: number, value: boolean) => { flip = value; }),
  };
  const frame = new Bitmap(new Uint8ClampedArray([0, 0, 180, 255, 180, 0, 0, 255]));
  return { upload, gl, frame, currentFlip: () => flip };
}
afterEach(() => vi.unstubAllGlobals());

describe("graded video upload orientation", () => {
  it("exposes opt-in media-free diagnostics for the actual upload branch", () => {
    const diagnostics = {};
    vi.stubGlobal("__INKFRAME_GRADING_DIAGNOSTICS__", diagnostics);
    const { upload, gl, frame } = setup();
    upload({ upload: () => true }, gl, frame, { ...cloneVideoFilterPreset("none"), exposure: 1 });
    expect(diagnostics).toEqual({
      runtime: "orientation-v2-diagnostic-v1", uploads: 1,
      sourceType: "Bitmap", outputType: "Canvas", convertedBitmap: true,
      previousFlip: true, uploadFlip: false, restoredFlip: true, succeeded: true,
    });
  });
  it("keeps pre-flipped bitmap rows identical in neutral and graded uploads", () => {
    const { upload, gl, frame, currentFlip } = setup();
    const sourceBefore = frame.pixels.slice();
    const uploaded: Uint8ClampedArray[] = [];
    const texture = { upload: vi.fn((_gl, source: Bitmap | Canvas) => {
      const bytes = source.pixels.slice();
      // WebGL ignores unpack flip for ImageBitmap, but honors it for canvas.
      uploaded.push(!(source instanceof Bitmap) && currentFlip()
        ? new Uint8ClampedArray([...bytes.slice(4), ...bytes.slice(0, 4)]) : bytes);
      return true;
    }) };
    expect(upload(texture, gl, frame, cloneVideoFilterPreset("none"))).toBe(true);
    expect(upload(texture, gl, frame, { ...cloneVideoFilterPreset("none"), exposure: -1 })).toBe(true);
    for (const pixels of uploaded) {
      expect(pixels[2]).toBeGreaterThan(pixels[0]); // blue first row
      expect(pixels[4]).toBeGreaterThan(pixels[6]); // red second row
    }
    expect(currentFlip()).toBe(true);
    expect(gl.pixelStorei.mock.calls).toEqual([[0x9240, false], [0x9240, true]]);
    expect(frame.pixels).toEqual(sourceBefore);
  });
  it.each([true, false])("restores previous flip=%s when upload throws", (initialFlip) => {
    const { upload, gl, frame, currentFlip } = setup(initialFlip);
    const error = new Error("upload failed");
    const texture = { upload: () => { throw error; } };
    expect(() => upload(texture, gl, frame, { ...cloneVideoFilterPreset("none"), exposure: 1 })).toThrow(error);
    expect(currentFlip()).toBe(initialFlip);
    expect(gl.pixelStorei.mock.calls).toEqual([[0x9240, false], [0x9240, initialFlip]]);
  });
  it.each([true, false])("restores previous flip=%s on unsuccessful upload", (initialFlip) => {
    const { upload, gl, frame, currentFlip } = setup(initialFlip);
    expect(upload({ upload: () => false }, gl, frame, { ...cloneVideoFilterPreset("none"), temperature: 1 })).toBe(false);
    expect(currentFlip()).toBe(initialFlip);
  });
  it("does not override upload state for neutral bitmaps or direct VideoFrame-like sources", () => {
    const { upload, gl, frame } = setup();
    const texture = { upload: vi.fn((_gl: unknown, _source: unknown) => true) };
    upload(texture, gl, frame, cloneVideoFilterPreset("none"));
    expect(texture.upload.mock.calls[0]).toEqual([gl, frame]);
    const directFrame = { width: 1, height: 2, pixels: frame.pixels.slice() };
    upload(texture, gl, directFrame, { ...cloneVideoFilterPreset("none"), exposure: 1 });
    expect(gl.pixelStorei).not.toHaveBeenCalled();
    expect(gl.getParameter).not.toHaveBeenCalled();
  });
});
