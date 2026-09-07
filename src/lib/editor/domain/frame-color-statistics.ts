export interface WeightedPaletteColor {
  hex: string;
  weight: number;
}

export type FrameRejectionReason =
  | "insufficient-pixels"
  | "mostly-black"
  | "mostly-white";

export interface FrameColorStatistics {
  width: number;
  height: number;
  sampledPixelCount: number;
  luminance: {
    low: number;
    median: number;
    high: number;
  };
  /** Median luminance expressed as stops relative to middle gray (0.18). */
  exposure: number;
  /** Red/blue chromatic balance. Positive values are warmer. */
  temperature: number;
  /** Green/magenta chromatic balance. Positive values are greener. */
  tint: number;
  saturation: number;
  blackFraction: number;
  whiteFraction: number;
  /** Conservative pixel heuristic, not face or identity detection. */
  skinToneFraction: number;
  palette: WeightedPaletteColor[];
  usable: boolean;
  rejectionReason?: FrameRejectionReason;
}

const round = (value: number, places = 4): number =>
  Number(value.toFixed(places));

const channelToLinear = (channel: number): number => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const percentile = (
  sorted: readonly number[],
  position: number,
  fallback = 0,
): number => {
  if (sorted.length === 0) return fallback;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * position)),
  );
  return sorted[index] ?? fallback;
};

const rgbToHsv = (
  red: number,
  green: number,
  blue: number,
): { hue: number; saturation: number } => {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  if (delta === 0) return { hue: 0, saturation: 0 };
  const rawHue = maximum === r
    ? ((g - b) / delta) % 6
    : maximum === g
      ? (b - r) / delta + 2
      : (r - g) / delta + 4;
  return {
    hue: (rawHue * 60 + 360) % 360,
    saturation: maximum === 0 ? 0 : delta / maximum,
  };
};

const isConservativeSkinTone = (
  red: number,
  green: number,
  blue: number,
  hue: number,
  saturation: number,
  luminance: number,
): boolean => {
  if (luminance < 0.025 || luminance > 0.82) return false;
  if (hue > 52 || saturation < 0.12 || saturation > 0.78) return false;
  const cb = 128 - 0.168736 * red - 0.331264 * green + 0.5 * blue;
  const cr = 128 + 0.5 * red - 0.418688 * green - 0.081312 * blue;
  return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
};

const toHex = (channel: number): string =>
  Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0");

interface PaletteBucket {
  count: number;
  red: number;
  green: number;
  blue: number;
}

export const analyzeFrameColorPixels = ({
  pixels,
  width,
  height,
}: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}): FrameColorStatistics => {
  const luminances: number[] = [];
  const saturations: number[] = [];
  const neutralTemperatures: number[] = [];
  const neutralTints: number[] = [];
  const fallbackTemperatures: number[] = [];
  const fallbackTints: number[] = [];
  const paletteBuckets = new Map<number, PaletteBucket>();
  let blackPixels = 0;
  let whitePixels = 0;
  let skinTonePixels = 0;

  const availablePixels = Math.min(
    Math.max(0, width * height),
    Math.floor(pixels.length / 4),
  );
  for (let index = 0; index < availablePixels; index += 1) {
    const offset = index * 4;
    if ((pixels[offset + 3] ?? 0) < 230) continue;
    const red = pixels[offset] ?? 0;
    const green = pixels[offset + 1] ?? 0;
    const blue = pixels[offset + 2] ?? 0;
    const linearRed = channelToLinear(red);
    const linearGreen = channelToLinear(green);
    const linearBlue = channelToLinear(blue);
    const luminance = 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
    const { hue, saturation } = rgbToHsv(red, green, blue);
    const chromaTotal = Math.max(0.0001, linearRed + linearGreen + linearBlue);
    const temperature = (linearRed - linearBlue) / chromaTotal;
    const tint = (linearGreen - (linearRed + linearBlue) / 2) / chromaTotal;

    luminances.push(luminance);
    saturations.push(saturation);
    if (luminance <= 0.01) blackPixels += 1;
    if (luminance >= 0.92) whitePixels += 1;
    if (isConservativeSkinTone(red, green, blue, hue, saturation, luminance)) {
      skinTonePixels += 1;
    }
    if (luminance >= 0.025 && luminance <= 0.82) {
      fallbackTemperatures.push(temperature);
      fallbackTints.push(tint);
      if (saturation <= 0.32) {
        neutralTemperatures.push(temperature);
        neutralTints.push(tint);
      }
    }

    const bucketKey = (red >> 5) << 6 | (green >> 5) << 3 | (blue >> 5);
    const bucket = paletteBuckets.get(bucketKey) ?? {
      count: 0,
      red: 0,
      green: 0,
      blue: 0,
    };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    paletteBuckets.set(bucketKey, bucket);
  }

  luminances.sort((left, right) => left - right);
  saturations.sort((left, right) => left - right);
  neutralTemperatures.sort((left, right) => left - right);
  neutralTints.sort((left, right) => left - right);
  fallbackTemperatures.sort((left, right) => left - right);
  fallbackTints.sort((left, right) => left - right);

  const sampledPixelCount = luminances.length;
  const low = percentile(luminances, 0.05);
  const medianLuminance = percentile(luminances, 0.5);
  const high = percentile(luminances, 0.95);
  const blackFraction = sampledPixelCount === 0 ? 0 : blackPixels / sampledPixelCount;
  const whiteFraction = sampledPixelCount === 0 ? 0 : whitePixels / sampledPixelCount;
  const chromaticTemperatures = neutralTemperatures.length >= 32
    ? neutralTemperatures
    : fallbackTemperatures;
  const chromaticTints = neutralTints.length >= 32 ? neutralTints : fallbackTints;

  const palette = [...paletteBuckets.values()]
    .sort((left, right) => right.count - left.count || left.red - right.red)
    .slice(0, 6)
    .map((bucket): WeightedPaletteColor => ({
      hex: `#${toHex(bucket.red / bucket.count)}${toHex(bucket.green / bucket.count)}${toHex(bucket.blue / bucket.count)}`,
      weight: round(bucket.count / Math.max(1, sampledPixelCount)),
    }));

  const rejectionReason: FrameRejectionReason | undefined = sampledPixelCount < 64
    ? "insufficient-pixels"
    : blackFraction >= 0.85
      ? "mostly-black"
      : whiteFraction >= 0.85
        ? "mostly-white"
        : undefined;

  return {
    width,
    height,
    sampledPixelCount,
    luminance: {
      low: round(low),
      median: round(medianLuminance),
      high: round(high),
    },
    exposure: round(Math.log2(Math.max(0.001, medianLuminance) / 0.18)),
    temperature: round(percentile(chromaticTemperatures, 0.5)),
    tint: round(percentile(chromaticTints, 0.5)),
    saturation: round(percentile(saturations, 0.5)),
    blackFraction: round(blackFraction),
    whiteFraction: round(whiteFraction),
    skinToneFraction: round(sampledPixelCount === 0 ? 0 : skinTonePixels / sampledPixelCount),
    palette,
    usable: rejectionReason === undefined,
    ...(rejectionReason ? { rejectionReason } : {}),
  };
};

