import { strToU8, zip } from "fflate";
import type { AssetRef, VersionTimeline } from "@/lib/editor/types";
import { generateCubeLut, hasInkframeColorLook } from "./fcpxml-color";
import { generateFcpxml, type TextExportResult } from "./fcpxml";
import {
  buildInterchangeTimeline,
  type ExportDiagnostic,
  type InterchangeTimeline,
} from "./timeline-interchange";

export interface BundleAsset extends AssetRef {
  file?: Blob;
}

export interface FcpxmlBundlePlan extends TextExportResult {
  timeline: InterchangeTimeline;
  media: Array<{ assetId: string; archivePath: string; file: Blob }>;
  looks: Array<{ clipId: string; archivePath: string; contents: string }>;
  manifest: {
    version: 1;
    assets: Array<{
      assetId: string;
      originalName: string;
      archivePath?: string;
      externalUrl?: string;
    }>;
    looks: Array<{
      clipId: string;
      archivePath: string;
      application: "manual";
    }>;
  };
}

export interface FcpxmlMediaBundle {
  blob: Blob;
  diagnostics: ExportDiagnostic[];
  includedMedia: number;
  linkedMedia: number;
  includedLooks: number;
}

const safeArchivePart = (value: string): string => {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, "-")
    .replace(/^\.+/, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
  return (normalized || "media").slice(0, 120);
};

const archiveMediaName = (asset: BundleAsset, index: number): string =>
  `${String(index + 1).padStart(4, "0")}-${safeArchivePart(asset.assetId)}-${safeArchivePart(asset.name)}`;

export const planFcpxmlMediaBundle = ({
  version,
  assets,
  name = "Inkframe Timeline",
}: {
  version: VersionTimeline;
  assets: readonly BundleAsset[];
  name?: string;
}): FcpxmlBundlePlan => {
  const timeline = buildInterchangeTimeline({ version, assets, name });
  const assetById = new Map(assets.map((asset) => [asset.assetId, asset]));
  const media: FcpxmlBundlePlan["media"] = [];
  const lookClips = version.clips
    .filter((clip) => hasInkframeColorLook(clip.videoFilter))
    .sort((left, right) => left.id.localeCompare(right.id));
  const lookClipIds = new Set(lookClips.map((clip) => clip.id));
  const looks: FcpxmlBundlePlan["looks"] = lookClips.map((clip, index) => ({
    clipId: clip.id,
    archivePath: `Looks/${String(index + 1).padStart(4, "0")}-${safeArchivePart(clip.id)}.cube`,
    contents: generateCubeLut({
      filter: clip.videoFilter!,
      title: `${name} - ${clip.id}`,
    }),
  }));
  const diagnostics = timeline.diagnostics.filter(
    (diagnostic) => diagnostic.code !== "NON_DURABLE_ASSET_URI" &&
      !(diagnostic.code === "VIDEO_FILTER_APPROXIMATED" &&
        diagnostic.itemId && lookClipIds.has(diagnostic.itemId)),
  );
  for (const clip of version.clips) {
    if (clip.videoFilter?.selectiveRegions?.length) diagnostics.push({
      severity: "warning",
      code: "SELECTIVE_GRADE_NOT_EXPORTED",
      message: `Selective grading regions on ${clip.id} cannot be encoded in a color LUT; recreate them manually or export MP4.`,
      itemId: clip.id,
    });
  }
  for (const look of looks) {
    diagnostics.push({
      severity: "warning",
      code: "COLOR_LOOK_LUT_INCLUDED",
      message: `An approximate .cube look for ${look.clipId} is included and must be applied manually in the target editor.`,
      itemId: look.clipId,
    });
  }

  const bundledAssets = timeline.assets.map((asset, index) => {
    const source = assetById.get(asset.id);
    if (source?.file) {
      const archivePath = `Media/${archiveMediaName(source, index)}`;
      media.push({ assetId: asset.id, archivePath, file: source.file });
      return { ...asset, uri: archivePath.split("/").map(encodeURIComponent).join("/") };
    }
    if (!asset.uri) {
      diagnostics.push({
        severity: "error",
        code: "BUNDLE_MEDIA_UNAVAILABLE",
        message: `Asset ${asset.name} has neither stored media bytes nor a durable source URL.`,
        itemId: asset.id,
      });
    }
    return asset;
  });
  const bundleTimeline = { ...timeline, assets: bundledAssets, diagnostics };
  const generated = generateFcpxml(bundleTimeline);
  const manifestAssets = timeline.assets.map((asset) => {
    const bundled = media.find((item) => item.assetId === asset.id);
    return {
      assetId: asset.id,
      originalName: asset.name,
      ...(bundled ? { archivePath: bundled.archivePath } : {}),
      ...(!bundled && asset.uri ? { externalUrl: asset.uri } : {}),
    };
  });

  return {
    ...generated,
    timeline: bundleTimeline,
    media,
    looks,
    manifest: {
      version: 1,
      assets: manifestAssets,
      looks: looks.map(({ clipId, archivePath }) => ({
        clipId,
        archivePath,
        application: "manual" as const,
      })),
    },
  };
};

const zipAsync = (
  files: Record<string, Uint8Array>,
): Promise<Uint8Array> => new Promise((resolve, reject) => {
  zip(files, { level: 0 }, (error, data) => {
    if (error) reject(error);
    else resolve(data);
  });
});

export const createFcpxmlMediaBundle = async (
  plan: FcpxmlBundlePlan,
): Promise<FcpxmlMediaBundle> => {
  const errors = plan.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length > 0) throw new Error(errors[0]?.message ?? "The media bundle is invalid.");

  const mediaEntries = await Promise.all(
    plan.media.map(async ({ archivePath, file }) => [
      archivePath,
      new Uint8Array(await file.arrayBuffer()),
    ] as const),
  );
  const readme = [
    "Inkframe editable timeline export",
    "",
    "1. Extract this ZIP without moving its contents.",
    "2. Import timeline.fcpxml into Final Cut Pro or DaVinci Resolve.",
    "3. If the editor asks for media, select the extracted Media folder.",
    "4. Apply any .cube files in Looks to the matching clip IDs listed in relink-manifest.json.",
    "",
    "relink-manifest.json maps every Inkframe asset ID to its packaged file or remote source.",
    "Review the compatibility report shown by Inkframe for effects that require reconstruction.",
    "",
  ].join("\n");
  const archive = await zipAsync({
    "timeline.fcpxml": strToU8(plan.content),
    "relink-manifest.json": strToU8(JSON.stringify(plan.manifest, null, 2)),
    "README.txt": strToU8(readme),
    ...Object.fromEntries(plan.looks.map((look) => [look.archivePath, strToU8(look.contents)])),
    ...Object.fromEntries(mediaEntries),
  });
  const archiveBytes = new Uint8Array(archive.byteLength);
  archiveBytes.set(archive);

  return {
    blob: new Blob([archiveBytes.buffer], { type: "application/zip" }),
    diagnostics: plan.diagnostics,
    includedMedia: plan.media.length,
    linkedMedia: plan.timeline.assets.length - plan.media.length,
    includedLooks: plan.looks.length,
  };
};
