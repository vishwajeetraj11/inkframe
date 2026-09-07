import type { VideoFilter } from "./types";

export const NEUTRAL_COLOR_GRADE = Object.freeze({
  exposure: 0, temperature: 0, tint: 0, shadows: 0, highlights: 0,
  toneCurve: "linear" as const,
});

const clamp = (x: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, x));
const bounded = (x: number | undefined, fallback: number, lo: number, hi: number): number =>
  typeof x === "number" && Number.isFinite(x) ? clamp(x, lo, hi) : fallback;

export function normalizeColorGrade(filter: Partial<VideoFilter> = {}) {
  return {
    exposure: bounded(filter.exposure, 0, -2, 2),
    temperature: bounded(filter.temperature, 0, -1, 1),
    tint: bounded(filter.tint, 0, -1, 1),
    shadows: bounded(filter.shadows, 0, -1, 1),
    highlights: bounded(filter.highlights, 0, -1, 1),
    toneCurve: filter.toneCurve === "filmic" ? "filmic" as const : "linear" as const,
    brightness: bounded(filter.brightness, 1, 0.5, 1.5),
    contrast: bounded(filter.contrast, 1, 0.5, 1.5),
    saturation: bounded(filter.saturation, 1, 0, 2),
    sepia: bounded(filter.sepia, 0, 0, 1),
    grayscale: bounded(filter.grayscale, 0, 0, 1),
    hueRotate: bounded(filter.hueRotate, 0, -30, 30),
  };
}

export function hasColorGrade(filter?: Partial<VideoFilter>): boolean {
  const f = normalizeColorGrade(filter);
  return f.exposure !== 0 || f.temperature !== 0 || f.tint !== 0 ||
    f.shadows !== 0 || f.highlights !== 0 || f.toneCurve !== "linear";
}

/** Legacy pass only; use on a source canvas BEFORE applyColorGradeToPixels.
 * Preset names do not override numeric controls, including preset "none". */
export function legacyVideoFilterToCss(filter?: Partial<VideoFilter>): string {
  const f = normalizeColorGrade(filter);
  if (f.brightness === 1 && f.contrast === 1 && f.saturation === 1 &&
      f.sepia === 0 && f.grayscale === 0 && f.hueRotate === 0) return "none";
  return `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturation}) sepia(${f.sepia}) grayscale(${f.grayscale}) hue-rotate(${f.hueRotate}deg)`;
}

export const srgbToLinear = (x: number): number =>
  x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
export const linearToSrgb = (x: number): number =>
  x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;

/** Gentle SDR S curve: monotonic, fixed black/white, 25% smoothstep blend.
 * This is a creative curve, not an HDR/log camera transform. */
export function filmicToneCurve(value: number): number {
  const x = clamp(value);
  return x + 0.25 * x * (1 - x) * (2 * x - 1);
}

const smoothstep = (lo: number, hi: number, value: number): number => {
  const x = clamp((value - lo) / (hi - lo));
  return x * x * (3 - 2 * x);
};
const decode = Float64Array.from({ length: 256 }, (_, x) => srgbToLinear(x / 255));

/** Mutates straight-alpha RGBA8 sRGB pixels; alpha is never changed.
 * NEW controls only. Caller first draws original media into an sRGB Canvas2D
 * using legacyVideoFilterToCss(filter), then passes getImageData().data here.
 * Order here: decode sRGB -> exposure/WB -> luminance-weighted shadows/highlights
 * -> optional filmic -> encode sRGB. Quantize once; preserve alpha.
 * `preset` is a label, never a bypass. No browser APIs or asset mutations.
 * Preview/export transpile this exact module and use the same legacy-first pass.
 */
export function applyColorGradeToPixels(pixels: Uint8ClampedArray, filter: VideoFilter): void {
  if (pixels.length % 4 !== 0) throw new RangeError("Expected complete RGBA pixels.");
  if (!hasColorGrade(filter)) return;
  const f = normalizeColorGrade(filter);
  const gainR = Math.pow(2, f.exposure + 0.35 * f.temperature + 0.15 * f.tint);
  const gainG = Math.pow(2, f.exposure - 0.3 * f.tint);
  const gainB = Math.pow(2, f.exposure - 0.35 * f.temperature + 0.15 * f.tint);
  for (let i = 0; i < pixels.length; i += 4) {
    let r = decode[pixels[i]] * gainR;
    let g = decode[pixels[i + 1]] * gainG;
    let b = decode[pixels[i + 2]] * gainB;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const toneGain = Math.pow(2,
      f.shadows * (1 - smoothstep(0, 0.25, y)) +
      f.highlights * smoothstep(0.25, 1, y));
    r *= toneGain; g *= toneGain; b *= toneGain;
    if (f.toneCurve === "filmic") {
      r = filmicToneCurve(r); g = filmicToneCurve(g); b = filmicToneCurve(b);
    }
    pixels[i] = clamp(linearToSrgb(clamp(r))) * 255;
    pixels[i + 1] = clamp(linearToSrgb(clamp(g))) * 255;
    pixels[i + 2] = clamp(linearToSrgb(clamp(b))) * 255;
  }
}
