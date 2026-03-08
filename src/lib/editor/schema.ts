import {
  MAX_AUDIO_FILE_BYTES,
  MAX_DURATION_FRAMES,
  MAX_IMAGE_FILE_BYTES,
  MAX_VIDEO_FILE_BYTES,
} from "./constants";
import { getTimelineDurationInFrames } from "./timeline";
import {
  CREATEDALEY_OPENER_TEXTURES,
  TEXT_OVERLAY_FONT_FAMILIES,
  TEXT_OVERLAY_FONT_STYLES,
  TEXT_OVERLAY_STYLE_PRESETS,
  type AssetKind,
} from "./types";
import { z } from "zod";

export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const isSupportedImageMimeType = (mimeType: string): boolean =>
  SUPPORTED_IMAGE_MIME_TYPES.includes(
    mimeType.trim().toLowerCase() as (typeof SUPPORTED_IMAGE_MIME_TYPES)[number],
  );

const aspectSchema = z.enum(["reel_9_16", "widescreen_16_9"]);
const assetKindSchema = z.enum(["video", "image", "audio"]);

const clipSchema = z
  .object({
    id: z.string().min(1),
    assetId: z.string().min(1),
    kind: z.enum(["video", "image"]),
    startFrame: z.number().int().min(0),
    endFrame: z.number().int().min(1),
    trimStartFrame: z.number().int().min(0),
    trimEndFrame: z.number().int().min(1),
    volume: z.number().min(0).max(1),
  })
  .superRefine((clip, context) => {
    if (clip.endFrame <= clip.startFrame) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endFrame"],
        message: "endFrame must be greater than startFrame.",
      });
    }

    if (clip.trimEndFrame <= clip.trimStartFrame) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trimEndFrame"],
        message: "trimEndFrame must be greater than trimStartFrame.",
      });
    }
  });

const textOverlaySchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    startFrame: z.number().int().min(0),
    endFrame: z.number().int().min(1),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    fontSize: z.number().int().min(12).max(200),
    color: z.string().min(1),
    fontFamily: z.enum(TEXT_OVERLAY_FONT_FAMILIES).default("sans"),
    fontWeight: z.number().int().min(100).max(900).default(700),
    fontStyle: z.enum(TEXT_OVERLAY_FONT_STYLES).default("normal"),
    stylePreset: z.enum(TEXT_OVERLAY_STYLE_PRESETS).default("classic"),
    createdaleyTexture: z.enum(CREATEDALEY_OPENER_TEXTURES).default("plain"),
  })
  .superRefine((overlay, context) => {
    if (overlay.endFrame <= overlay.startFrame) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endFrame"],
        message: "endFrame must be greater than startFrame.",
      });
    }
  });

const audioTrackSchema = z
  .object({
    id: z.string().min(1),
    assetId: z.string().min(1),
    startFrame: z.number().int().min(0),
    endFrame: z.number().int().min(1),
    trimStartFrame: z.number().int().min(0),
    trimEndFrame: z.number().int().min(1),
    volume: z.number().min(0).max(1),
  })
  .superRefine((track, context) => {
    if (track.endFrame <= track.startFrame) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endFrame"],
        message: "endFrame must be greater than startFrame.",
      });
    }

    if (track.trimEndFrame <= track.trimStartFrame) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trimEndFrame"],
        message: "trimEndFrame must be greater than trimStartFrame.",
      });
    }
  });

const transitionSchema = z.object({
  id: z.string().min(1),
  type: z.literal("crossfade"),
  durationInFrames: z.number().int().min(1),
  fromClipId: z.string().min(1),
  toClipId: z.string().min(1),
});

const versionTimelineSchema = z.object({
  aspect: aspectSchema,
  clips: z.array(clipSchema),
  textOverlays: z.array(textOverlaySchema),
  audioTracks: z.array(audioTrackSchema),
  transitions: z.array(transitionSchema),
});

const assetRefSchema = z.object({
  assetId: z.string().min(1),
  kind: assetKindSchema,
  mimeType: z.string().min(1),
  name: z.string().min(1),
  size: z.number().int().min(1),
});

const clipHasAdjacentTransition = (
  fromClipId: string,
  toClipId: string,
  clipIds: string[],
): boolean => {
  const fromIndex = clipIds.indexOf(fromClipId);
  const toIndex = clipIds.indexOf(toClipId);

  return fromIndex !== -1 && toIndex === fromIndex + 1;
};

export const exportProjectSchema = z
  .object({
    activeVersion: aspectSchema,
    versions: z.object({
      reel_9_16: versionTimelineSchema,
      widescreen_16_9: versionTimelineSchema,
    }),
    assets: z.array(assetRefSchema),
  })
  .superRefine((project, context) => {
    const seenAssetIds = new Set<string>();

    for (const [index, asset] of project.assets.entries()) {
      if (seenAssetIds.has(asset.assetId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assets", index, "assetId"],
          message: `Duplicate assetId: ${asset.assetId}`,
        });
      }

      seenAssetIds.add(asset.assetId);
    }

    if (project.versions.reel_9_16.aspect !== "reel_9_16") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["versions", "reel_9_16", "aspect"],
        message: "Version aspect must match key reel_9_16.",
      });
    }

    if (project.versions.widescreen_16_9.aspect !== "widescreen_16_9") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["versions", "widescreen_16_9", "aspect"],
        message: "Version aspect must match key widescreen_16_9.",
      });
    }

    const assetById = new Map(project.assets.map((asset) => [asset.assetId, asset]));

    const versionEntries = [
      ["reel_9_16", project.versions.reel_9_16],
      ["widescreen_16_9", project.versions.widescreen_16_9],
    ] as const;

    for (const [versionName, version] of versionEntries) {
      const duration = getTimelineDurationInFrames(version);
      if (duration > MAX_DURATION_FRAMES) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["versions", versionName],
          message: `Timeline exceeds ${MAX_DURATION_FRAMES} frames.`,
        });
      }

      const clipIds = version.clips.map((clip) => clip.id);

      for (const [clipIndex, clip] of version.clips.entries()) {
        const asset = assetById.get(clip.assetId);
        if (!asset) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["versions", versionName, "clips", clipIndex, "assetId"],
            message: `Unknown assetId ${clip.assetId}`,
          });
          continue;
        }

        if (asset.kind !== clip.kind) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["versions", versionName, "clips", clipIndex, "kind"],
            message: `Clip kind ${clip.kind} does not match asset kind ${asset.kind}.`,
          });
        }
      }

      for (const [audioIndex, audio] of version.audioTracks.entries()) {
        const asset = assetById.get(audio.assetId);
        if (!asset) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["versions", versionName, "audioTracks", audioIndex, "assetId"],
            message: `Unknown assetId ${audio.assetId}`,
          });
          continue;
        }

        if (asset.kind !== "audio") {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["versions", versionName, "audioTracks", audioIndex, "assetId"],
            message: `Audio track asset ${audio.assetId} must have kind audio.`,
          });
        }
      }

      for (const [transitionIndex, transition] of version.transitions.entries()) {
        if (
          !clipHasAdjacentTransition(
            transition.fromClipId,
            transition.toClipId,
            clipIds,
          )
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["versions", versionName, "transitions", transitionIndex],
            message: "Transitions must connect adjacent clips in timeline order.",
          });
        }
      }
    }

    const activeTimeline = project.versions[project.activeVersion];
    const hasRenderableVisuals =
      activeTimeline.clips.length > 0 || activeTimeline.textOverlays.length > 0;

    if (!hasRenderableVisuals) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["versions", project.activeVersion],
        message:
          "Active version must contain at least one clip or text overlay to export.",
      });
    }
  });

export type ExportProjectInput = z.infer<typeof exportProjectSchema>;

export const assetKindFromMimeType = (mimeType: string): AssetKind | null => {
  if (mimeType.startsWith("video/")) {
    return "video";
  }

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.startsWith("audio/")) {
    return "audio";
  }

  return null;
};

export const extractAssetIdFromUploadedFilename = (
  filename: string,
): string | null => {
  const separator = "__";
  const separatorIndex = filename.indexOf(separator);

  if (separatorIndex <= 0) {
    return null;
  }

  return filename.slice(0, separatorIndex);
};

export const validateUploadedAssetFile = (
  file: File,
  expectedKind: AssetKind,
): string | null => {
  const detectedKind = assetKindFromMimeType(file.type);

  if (detectedKind && detectedKind !== expectedKind) {
    return `Asset kind mismatch for ${file.name}. Expected ${expectedKind}, got ${detectedKind}.`;
  }

  switch (expectedKind) {
    case "video": {
      if (file.size > MAX_VIDEO_FILE_BYTES) {
        return `Video ${file.name} exceeds 100MB.`;
      }
      return null;
    }
    case "image": {
      if (file.type && !isSupportedImageMimeType(file.type)) {
        return `Image ${file.name} must be JPG, PNG, or WEBP.`;
      }

      if (file.size > MAX_IMAGE_FILE_BYTES) {
        return `Image ${file.name} exceeds 10MB.`;
      }
      return null;
    }
    case "audio": {
      if (file.size > MAX_AUDIO_FILE_BYTES) {
        return `Audio ${file.name} exceeds 100MB.`;
      }
      return null;
    }
    default: {
      return "Unsupported asset kind.";
    }
  }
};
