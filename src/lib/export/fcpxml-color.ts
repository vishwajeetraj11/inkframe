import {
  applyColorGradeToPixels,
  normalizeColorGrade,
} from "@/lib/editor/color-grading";
import type { VideoFilter } from "@/lib/editor/types";

type Rgb = readonly [number, number, number];
type Matrix3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const applyMatrix = ([red, green, blue]: Rgb, matrix: Matrix3): Rgb => [
  clamp01(matrix[0] * red + matrix[1] * green + matrix[2] * blue),
  clamp01(matrix[3] * red + matrix[4] * green + matrix[5] * blue),
  clamp01(matrix[6] * red + matrix[7] * green + matrix[8] * blue),
];

const mixMatrix = (amount: number, target: Matrix3): Matrix3 => {
  const inverse = 1 - amount;
  return [
    inverse + amount * target[0], amount * target[1], amount * target[2],
    amount * target[3], inverse + amount * target[4], amount * target[5],
    amount * target[6], amount * target[7], inverse + amount * target[8],
  ];
};

const saturationMatrix = (amount: number): Matrix3 => [
  0.213 + 0.787 * amount, 0.715 - 0.715 * amount, 0.072 - 0.072 * amount,
  0.213 - 0.213 * amount, 0.715 + 0.285 * amount, 0.072 - 0.072 * amount,
  0.213 - 0.213 * amount, 0.715 - 0.715 * amount, 0.072 + 0.928 * amount,
];

const hueRotationMatrix = (degrees: number): Matrix3 => {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    0.213 + 0.787 * cosine - 0.213 * sine,
    0.715 - 0.715 * cosine - 0.715 * sine,
    0.072 - 0.072 * cosine + 0.928 * sine,
    0.213 - 0.213 * cosine + 0.143 * sine,
    0.715 + 0.285 * cosine + 0.14 * sine,
    0.072 - 0.072 * cosine - 0.283 * sine,
    0.213 - 0.213 * cosine - 0.787 * sine,
    0.715 - 0.715 * cosine + 0.715 * sine,
    0.072 + 0.928 * cosine + 0.072 * sine,
  ];
};

const SEPIA_MATRIX: Matrix3 = [
  0.393, 0.769, 0.189,
  0.349, 0.686, 0.168,
  0.272, 0.534, 0.131,
];

const GRAYSCALE_MATRIX: Matrix3 = [
  0.2126, 0.7152, 0.0722,
  0.2126, 0.7152, 0.0722,
  0.2126, 0.7152, 0.0722,
];

/**
 * Samples Inkframe's ordered browser color pipeline into an RGB triplet.
 * The legacy CSS stage is represented with the CSS Filter Effects matrices;
 * the additive linear-light stage calls the same implementation as preview
 * and MP4 export. The result is suitable for an explicit approximation LUT.
 */
export const applyInkframeColorLook = (
  input: Rgb,
  filter: VideoFilter,
): Rgb => {
  const normalized = normalizeColorGrade(filter);
  let color: Rgb = input.map(clamp01) as unknown as Rgb;
  color = color.map((channel) => clamp01(channel * normalized.brightness)) as unknown as Rgb;
  color = color.map((channel) =>
    clamp01((channel - 0.5) * normalized.contrast + 0.5)) as unknown as Rgb;
  color = applyMatrix(color, saturationMatrix(normalized.saturation));
  color = applyMatrix(color, mixMatrix(normalized.sepia, SEPIA_MATRIX));
  color = applyMatrix(color, mixMatrix(normalized.grayscale, GRAYSCALE_MATRIX));
  color = applyMatrix(color, hueRotationMatrix(normalized.hueRotate));

  // Canvas getImageData quantizes the legacy pass before Inkframe's shared
  // linear-light grading pass, so retain that boundary in the LUT sampler.
  const pixel = new Uint8ClampedArray([
    color[0] * 255,
    color[1] * 255,
    color[2] * 255,
    255,
  ]);
  // A color-only LUT has no spatial coordinates and cannot encode masks.
  applyColorGradeToPixels(pixel, { ...filter, selectiveRegions: undefined });
  return [pixel[0] / 255, pixel[1] / 255, pixel[2] / 255];
};

export const hasInkframeColorLook = (filter: VideoFilter | undefined): boolean => {
  if (!filter) return false;
  const value = normalizeColorGrade(filter);
  return value.brightness !== 1 || value.contrast !== 1 || value.saturation !== 1 ||
    value.sepia !== 0 || value.grayscale !== 0 || value.hueRotate !== 0 ||
    value.exposure !== 0 || value.temperature !== 0 || value.tint !== 0 ||
    value.shadows !== 0 || value.highlights !== 0 || value.toneCurve !== "linear";
};

/** Build a portable .cube look for manual application in the target editor. */
export const generateCubeLut = ({
  filter,
  title,
  size = 17,
}: {
  filter: VideoFilter;
  title: string;
  size?: number;
}): string => {
  if (!Number.isInteger(size) || size < 2 || size > 65) {
    throw new RangeError("A 3D LUT size must be an integer from 2 through 65.");
  }
  const safeTitle = title.replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").replaceAll('"', "'").trim();
  const lines = [
    `TITLE "${safeTitle || "Inkframe look"}"`,
    `LUT_3D_SIZE ${size}`,
    "DOMAIN_MIN 0.0 0.0 0.0",
    "DOMAIN_MAX 1.0 1.0 1.0",
  ];
  const denominator = size - 1;
  for (let blue = 0; blue < size; blue += 1) {
    for (let green = 0; green < size; green += 1) {
      for (let red = 0; red < size; red += 1) {
        const output = applyInkframeColorLook(
          [red / denominator, green / denominator, blue / denominator],
          filter,
        );
        lines.push(output.map((channel) => channel.toFixed(6)).join(" "));
      }
    }
  }
  return `${lines.join("\n")}\n`;
};
