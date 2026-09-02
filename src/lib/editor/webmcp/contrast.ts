import { ASPECT_PRESETS } from "../constants";
import type { TextOverlay, VersionTimeline } from "../types";
import type { EditorContrastCheck } from "../export-state";

const channelToLinear = (channel: number): number => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
};

const luminance = (red: number, green: number, blue: number): number =>
  0.2126 * channelToLinear(red) +
  0.7152 * channelToLinear(green) +
  0.0722 * channelToLinear(blue);

const parseHex = (value: string): [number, number, number] | null => {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) return null;
  const raw = match[1];
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ];
};

const ratioFor = (left: number, right: number): number =>
  (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);

const boundsFor = (
  overlay: TextOverlay,
  width: number,
  height: number,
  sourceWidth: number,
) => {
  const scale = width / sourceWidth;
  const fontSize = Math.max(1, overlay.fontSize * scale);
  const lines = overlay.text.split("\n");
  const estimatedWidth = Math.min(
    width * 0.96,
    Math.max(fontSize * 1.5, ...lines.map((line) => line.length * fontSize * 0.56)),
  );
  const estimatedHeight = Math.min(height * 0.5, Math.max(fontSize * 1.25, lines.length * fontSize * 1.25));
  const anchorX = (overlay.x / 100) * width;
  const anchorY = (overlay.y / 100) * height;
  const left = overlay.textAlign === "left"
    ? anchorX
    : overlay.textAlign === "right"
      ? anchorX - estimatedWidth
      : anchorX - estimatedWidth / 2;
  return {
    left: Math.max(0, Math.floor(left)),
    top: Math.max(0, Math.floor(anchorY - estimatedHeight / 2)),
    right: Math.min(width, Math.ceil(left + estimatedWidth)),
    bottom: Math.min(height, Math.ceil(anchorY + estimatedHeight / 2)),
  };
};

const medianBackgroundLuminance = (
  pixels: Uint8ClampedArray,
  width: number,
  bounds: ReturnType<typeof boundsFor>,
): number | null => {
  const values: number[] = [];
  const step = Math.max(1, Math.floor(Math.min(bounds.right - bounds.left, bounds.bottom - bounds.top) / 32));
  for (let y = bounds.top; y < bounds.bottom; y += step) {
    for (let x = bounds.left; x < bounds.right; x += step) {
      const offset = (y * width + x) * 4;
      if ((pixels[offset + 3] ?? 0) < 230) continue;
      values.push(luminance(pixels[offset] ?? 0, pixels[offset + 1] ?? 0, pixels[offset + 2] ?? 0));
    }
  }
  if (values.length < 4) return null;
  values.sort((left, right) => left - right);
  return values[Math.floor(values.length / 2)] ?? null;
};

export const analyzeFrameContrast = ({
  pixels,
  width,
  height,
  version,
  frame,
}: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  version: VersionTimeline;
  frame: number;
}): EditorContrastCheck[] => {
  if (pixels.length < width * height * 4) return [];
  const sourceWidth = ASPECT_PRESETS[version.aspect].width;
  return version.textOverlays
    .filter((overlay) => frame >= overlay.startFrame && frame < overlay.endFrame)
    .flatMap((overlay): EditorContrastCheck[] => {
      const textRgb = parseHex(overlay.color);
      if (!textRgb) return [];
      const background = medianBackgroundLuminance(
        pixels,
        width,
        boundsFor(overlay, width, height, sourceWidth),
      );
      if (background === null) return [];
      const text = luminance(...textRgb);
      const contrastRatio = ratioFor(text, background);
      const largeText = overlay.fontSize >= 24 || (overlay.fontSize >= 18 && overlay.fontWeight >= 700);
      const minimumRatio = largeText ? 3 : 4.5;
      const whiteRatio = ratioFor(1, background);
      const blackRatio = ratioFor(0, background);
      return [{
        overlayId: overlay.id,
        contrastRatio: Number(contrastRatio.toFixed(2)),
        minimumRatio,
        passes: contrastRatio >= minimumRatio,
        sampledBackgroundLuminance: Number(background.toFixed(4)),
        recommendedColor: whiteRatio >= blackRatio ? "#ffffff" : "#000000",
      }];
    });
};
