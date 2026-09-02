"use client";

import { mediaLibraryStore, type MediaAsset } from "@elah/editor";
import { useEffect } from "react";
import { FPS } from "@/lib/editor/constants";
import type { AssetRef, VersionTimeline } from "@/lib/editor/types";

interface ElahMediaLibraryBridgeProps {
  assets: readonly AssetRef[];
  assetSources: Readonly<Record<string, string>>;
  version: VersionTimeline;
}

const getDurationSeconds = (assetId: string, version: VersionTimeline): number => {
  const visualFrames = version.clips
    .filter((clip) => clip.assetId === assetId)
    .reduce((maximum, clip) => Math.max(maximum, clip.trimEndFrame), 0);
  const audioFrames = version.audioTracks
    .filter((track) => track.assetId === assetId)
    .reduce((maximum, track) => Math.max(maximum, track.trimEndFrame), 0);

  return Math.max(1 / FPS, Math.max(visualFrames, audioFrames) / FPS);
};

const computeWaveform = async (source: string): Promise<Float32Array | undefined> => {
  if (typeof AudioContext === "undefined") return undefined;

  const response = await fetch(source);
  if (!response.ok) return undefined;

  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    const channel = buffer.getChannelData(0);
    const bucketCount = Math.min(512, Math.max(64, Math.floor(buffer.duration * 24)));
    const bucketSize = Math.max(1, Math.floor(channel.length / bucketCount));
    const waveform = new Float32Array(bucketCount);

    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const start = bucket * bucketSize;
      const end = Math.min(channel.length, start + bucketSize);
      let peak = 0;
      for (let sample = start; sample < end; sample += 1) {
        peak = Math.max(peak, Math.abs(channel[sample] ?? 0));
      }
      waveform[bucket] = peak;
    }

    return waveform;
  } finally {
    await context.close();
  }
};

/**
 * Inkframe owns asset lifecycle while Elah owns timeline rendering. This bridge
 * mirrors safe media metadata into Elah so its native waveform and clip UI can
 * resolve the same asset ids without taking ownership of the underlying files.
 */
export const ElahMediaLibraryBridge = ({
  assets,
  assetSources,
  version,
}: ElahMediaLibraryBridgeProps) => {
  useEffect(() => {
    const activeIds = new Set(assets.map((asset) => asset.assetId));
    const state = mediaLibraryStore.getState();

    for (const existingId of state.order) {
      if (!activeIds.has(existingId)) {
        state.removeAsset(existingId);
      }
    }

    for (const asset of assets) {
      const source = assetSources[asset.assetId] ?? asset.externalUrl;
      if (!source) continue;

      const existing = mediaLibraryStore.getState().getAsset(asset.assetId);
      const mediaAsset: MediaAsset = {
        id: asset.assetId,
        kind: asset.kind,
        name: asset.name,
        src: source,
        durationSec: getDurationSeconds(asset.assetId, version),
        byteSize: asset.size,
        lastModified: 0,
        addedAt: existing?.addedAt ?? Date.now(),
        waveform: existing?.waveform,
      };

      if (existing) {
        mediaLibraryStore.getState().updateAsset(asset.assetId, mediaAsset);
      } else {
        mediaLibraryStore.getState().addAsset(mediaAsset);
      }

      if (asset.kind === "audio" && !existing?.waveform) {
        void computeWaveform(source)
          .then((waveform) => {
            if (waveform && mediaLibraryStore.getState().getAsset(asset.assetId)) {
              mediaLibraryStore.getState().updateAsset(asset.assetId, { waveform });
            }
          })
          .catch(() => {
            // A waveform is an enhancement. Unsupported or cross-origin audio
            // still remains playable and exportable through Elah.
          });
      }
    }
  }, [assetSources, assets, version]);

  return null;
};
