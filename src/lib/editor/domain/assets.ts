import type { VersionTimeline } from "../types";

export const collectUsedAssetIds = (version: VersionTimeline): Set<string> => {
  const usedAssetIds = new Set<string>();

  for (const clip of version.clips) {
    usedAssetIds.add(clip.assetId);
  }

  for (const audioTrack of version.audioTracks) {
    usedAssetIds.add(audioTrack.assetId);
  }

  return usedAssetIds;
};
