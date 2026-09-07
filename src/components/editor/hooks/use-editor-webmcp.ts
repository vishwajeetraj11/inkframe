"use client";

import { useWebMcpTools, type WebMcpToolFactory } from "@/components/webmcp/use-webmcp-tools";
import type { AIEditorActions } from "@/lib/editor/ai-actions";
import type { EditorHistoryAction, EditorHistoryState } from "@/lib/editor/history";
import type { AspectPreset, AssetRef } from "@/lib/editor/types";
import type {
  PexelsPhotoSearchResult,
  PexelsVideoSearchResult,
} from "@/lib/pexels";
import {
  createEditorWebMcpTools,
  type AudioUrlImportInput,
  type EditorWebMcpCallbackResult,
  type LicensedAudioImportInput,
} from "@/lib/editor/webmcp/tools";
import type { LicensedAudioSearchResult } from "@/lib/stock-audio";
import type {
  EditorExportState,
  EditorFrameCapture,
  EditorVisualReview,
} from "./editor-session-types";
import { nanoid } from "nanoid";
import { flushSync } from "react-dom";
import { captureColorComparison } from "@/lib/editor/webmcp/color-evidence";
import { getActiveTimeline } from "@/lib/editor/cutdowns";
import { detectRuntimeCapabilities } from "@/lib/webmcp/runtime-capabilities";
import { trackVideoObject } from "@/lib/export/object-tracking-browser";

export interface EditorWebMcpBridge {
  history: EditorHistoryState;
  dispatch: (action: EditorHistoryAction) => void;
  undo: () => void;
  redo: () => void;
  assets: readonly AssetRef[];
  assetSources?: Readonly<Record<string, string>>;
  selectClip: (clipId: string) => void;
  selectText: (overlayId: string) => void;
  selectAudio: (trackId: string) => void;
  applyAIEditorActions: (actions: AIEditorActions) => Promise<{ ok: boolean; message: string }>;
  requestExport: () => EditorWebMcpCallbackResult;
  requestTimelineExport: (
    format: "fcpxml" | "edl" | "fcpxml-bundle",
  ) => EditorWebMcpCallbackResult | Promise<EditorWebMcpCallbackResult>;
  getExportState: () => EditorExportState;
  cancelExport: () => EditorWebMcpCallbackResult;
  captureFrame: (frame: number, includeImage: boolean) => Promise<EditorFrameCapture>;
  publishVisualReview: (review: EditorVisualReview) => void;
  getRenderDiagnostics: (aspect: AspectPreset) => unknown;
  removeAsset: (assetId: string) => void;
  requestMediaPicker: () => void;
  searchStockVideos: (
    query: string,
    aspect: AspectPreset,
    signal: AbortSignal,
  ) => Promise<PexelsVideoSearchResult>;
  importStockVideo: (
    query: string,
    videoId: number,
    aspect: AspectPreset,
    signal: AbortSignal,
  ) => Promise<{ ok: boolean; message: string }>;
  searchStockPhotos: (
    query: string,
    aspect: AspectPreset,
    signal: AbortSignal,
  ) => Promise<PexelsPhotoSearchResult>;
  importStockPhoto: (
    query: string,
    photoId: number,
    aspect: AspectPreset,
    signal: AbortSignal,
  ) => Promise<{ ok: boolean; message: string }>;
  searchLicensedMusic: (
    query: string,
    signal: AbortSignal,
  ) => Promise<LicensedAudioSearchResult>;
  importLicensedMusic: (
    input: LicensedAudioImportInput,
    signal: AbortSignal,
  ) => Promise<{ ok: boolean; message: string }>;
  searchLicensedSoundEffects: (
    query: string,
    signal: AbortSignal,
  ) => Promise<LicensedAudioSearchResult>;
  importLicensedSoundEffect: (
    input: LicensedAudioImportInput,
    signal: AbortSignal,
  ) => Promise<{ ok: boolean; message: string }>;
  importAudioFromUrl: (
    input: AudioUrlImportInput,
    signal: AbortSignal,
  ) => Promise<{ ok: boolean; message: string }>;
}

export const startEditorWebMcpExport = (
  requestExport: () => EditorWebMcpCallbackResult,
): EditorWebMcpCallbackResult => requestExport();

const createTools: WebMcpToolFactory<EditorWebMcpBridge> = (getCurrent) =>
  createEditorWebMcpTools({
    trackObject: async (aspect, clipId, box, signal) => {
      const current = getCurrent();
      const version = getActiveTimeline(current.history.present).aspect === aspect
        ? getActiveTimeline(current.history.present) : current.history.present.versions[aspect];
      const clip = version.clips.find((item) => item.id === clipId);
      const asset = current.assets.find((item) => item.assetId === clip?.assetId);
      const url = clip && (current.assetSources?.[clip.assetId] ?? asset?.externalUrl);
      if (!clip || !url) throw new Error("TRACKING_SOURCE_UNAVAILABLE: Import the source video first.");
      return trackVideoObject({ url, clip, box, transitions: version.transitions, signal });
    },
    getRuntimeCapabilities: () => detectRuntimeCapabilities(),
    getState: () => getCurrent().history,
    getActiveVersion: () => getActiveTimeline(getCurrent().history.present),
    getAssets: () => getCurrent().assets,
    analyzeMusic: async (assetId, options, signal) => {
      const current = getCurrent();
      const url = current.assetSources?.[assetId] ?? current.assets.find((asset) => asset.assetId === assetId)?.externalUrl;
      if (!url) throw new Error("Music source unavailable; reimport the audio file");
      const { analyzeMusicUrl } = await import("@/lib/editor/webmcp/beat-audio-browser");
      return analyzeMusicUrl(url, { ...options, signal });
    },
    sampleVideoMoments: async (assetId, durationSeconds, signal) => {
      const current = getCurrent();
      const url = current.assetSources?.[assetId] ?? current.assets.find((asset) => asset.assetId === assetId)?.externalUrl;
      if (!url) throw new Error("Video source unavailable; reimport the video file");
      const { sampleVideoMoments } = await import("@/lib/editor/webmcp/beat-video-browser");
      return sampleVideoMoments(url, { durationSeconds, signal });
    },
    dispatch: (action) => flushSync(() => getCurrent().dispatch(action)),
    dispatchCommand: (action) => flushSync(() => getCurrent().dispatch(action)),
    undo: () => flushSync(() => getCurrent().undo()),
    redo: () => flushSync(() => getCurrent().redo()),
    createId: () => nanoid(10),
    selectClip: (clipId) => flushSync(() => getCurrent().selectClip(clipId)),
    selectText: (overlayId) => flushSync(() => getCurrent().selectText(overlayId)),
    selectAudio: (trackId) => flushSync(() => getCurrent().selectAudio(trackId)),
    applyAIEditorActions: async (actions, signal) => {
      if (signal.aborted) throw signal.reason;
      const result = await getCurrent().applyAIEditorActions(actions);
      if (signal.aborted) throw signal.reason;
      return result;
    },
    requestExport: (signal) => {
      if (signal.aborted) throw signal.reason;
      return startEditorWebMcpExport(() => getCurrent().requestExport());
    },
    requestTimelineExport: (format, signal) => {
      if (signal.aborted) throw signal.reason;
      return getCurrent().requestTimelineExport(format);
    },
    getExportState: () => getCurrent().getExportState(),
    cancelExport: (signal) => {
      if (signal.aborted) throw signal.reason;
      return getCurrent().cancelExport();
    },
    captureFrame: async (frame, includeImage, signal) => {
      if (signal.aborted) throw signal.reason;
      const capture = await getCurrent().captureFrame(frame, includeImage);
      if (signal.aborted) throw signal.reason;
      return capture;
    },
    publishVisualReview: (review) => getCurrent().publishVisualReview(review),
    captureColorComparison: async (aspect, clipId, before, after, signal) => {
      const current = getCurrent();
      return captureColorComparison({
        version: current.history.present.versions[aspect],
        assets: current.assets.map((asset) => ({ ...asset, objectUrl: current.assetSources?.[asset.assetId] })),
        clipId, before, after, signal,
      });
    },
    getRenderDiagnostics: (aspect) => getCurrent().getRenderDiagnostics(aspect),
    removeAsset: (assetId, signal) => {
      if (signal.aborted) throw signal.reason;
      flushSync(() => getCurrent().removeAsset(assetId));
      return { ok: true, message: "Asset removed" };
    },
    requestMediaPicker: (signal) => {
      if (signal.aborted) throw signal.reason;
      getCurrent().requestMediaPicker();
    },
    searchStockVideos: (query, aspect, signal) =>
      getCurrent().searchStockVideos(query, aspect, signal),
    importStockVideo: (query, videoId, aspect, signal) =>
      getCurrent().importStockVideo(query, videoId, aspect, signal),
    searchStockPhotos: (query, aspect, signal) =>
      getCurrent().searchStockPhotos(query, aspect, signal),
    importStockPhoto: (query, photoId, aspect, signal) =>
      getCurrent().importStockPhoto(query, photoId, aspect, signal),
    searchLicensedMusic: (query, signal) =>
      getCurrent().searchLicensedMusic(query, signal),
    importLicensedMusic: (input, signal) =>
      getCurrent().importLicensedMusic(input, signal),
    searchLicensedSoundEffects: (query, signal) =>
      getCurrent().searchLicensedSoundEffects(query, signal),
    importLicensedSoundEffect: (input, signal) =>
      getCurrent().importLicensedSoundEffect(input, signal),
    importAudioFromUrl: (input, signal) =>
      getCurrent().importAudioFromUrl(input, signal),
  });

export const useEditorWebMcp = (bridge: EditorWebMcpBridge): void => {
  useWebMcpTools(bridge, createTools);
};
