import type { VideoFilter, VideoFilterPreset } from "./types";

export const VIDEO_FILTER_PRESETS: Record<VideoFilterPreset, VideoFilter> = {
  none: { preset: "none", brightness: 1, contrast: 1, saturation: 1, sepia: 0, grayscale: 0, hueRotate: 0 },
  cinematic: { preset: "cinematic", brightness: 0.94, contrast: 1.18, saturation: 0.88, sepia: 0.06, grayscale: 0, hueRotate: -3 },
  warm: { preset: "warm", brightness: 1.02, contrast: 1.05, saturation: 1.08, sepia: 0.16, grayscale: 0, hueRotate: -5 },
  cool: { preset: "cool", brightness: 0.98, contrast: 1.08, saturation: 0.94, sepia: 0, grayscale: 0, hueRotate: 8 },
  vintage: { preset: "vintage", brightness: 0.96, contrast: 0.92, saturation: 0.78, sepia: 0.32, grayscale: 0, hueRotate: -6 },
  mono: { preset: "mono", brightness: 0.98, contrast: 1.16, saturation: 0, sepia: 0, grayscale: 1, hueRotate: 0 },
};

export const cloneVideoFilterPreset = (preset: VideoFilterPreset): VideoFilter => ({
  ...VIDEO_FILTER_PRESETS[preset],
});

export const videoFilterToCss = (filter: VideoFilter | undefined): string => {
  if (!filter || filter.preset === "none") return "none";
  return [
    `brightness(${filter.brightness})`,
    `contrast(${filter.contrast})`,
    `saturate(${filter.saturation})`,
    `sepia(${filter.sepia})`,
    `grayscale(${filter.grayscale})`,
    `hue-rotate(${filter.hueRotate}deg)`,
  ].join(" ");
};
