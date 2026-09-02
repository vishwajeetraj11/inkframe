"use client";

import { useWebMcpTools, type WebMcpToolFactory } from "@/components/webmcp/use-webmcp-tools";
import type { AIEditorActions } from "@/lib/editor/ai-actions";
import type { EditorHistoryState } from "@/lib/editor/history";
import type { SoundEffectId } from "@/lib/editor/sound-effects";
import type { EditorAction } from "@/lib/editor/reducer";
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
} from "./editor-session-types";
import { nanoid } from "nanoid";
import { flushSync } from "react-dom";

export interface EditorWebMcpBridge {
  history: EditorHistoryState;
  dispatch: (action: EditorAction) => void;
  undo: () => void;
  redo: () => void;
  assets: readonly AssetRef[];
  selectClip: (clipId: string) => void;
  selectText: (overlayId: string) => void;
  selectAudio: (trackId: string) => void;
  addSoundEffect: (effectId: SoundEffectId, aspect: AspectPreset) => void;
  applyAIEditorActions: (actions: AIEditorActions) => Promise<{ ok: boolean; message: string }>;
  requestExport: () => EditorWebMcpCallbackResult;
  getExportState: () => EditorExportState;
  cancelExport: () => EditorWebMcpCallbackResult;
  captureFrame: (frame: number, includeImage: boolean) => Promise<EditorFrameCapture>;
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
    getState: () => getCurrent().history,
    getAssets: () => getCurrent().assets,
    dispatch: (action) => flushSync(() => getCurrent().dispatch(action)),
    undo: () => flushSync(() => getCurrent().undo()),
    redo: () => flushSync(() => getCurrent().redo()),
    createId: () => nanoid(10),
    selectClip: (clipId) => flushSync(() => getCurrent().selectClip(clipId)),
    selectText: (overlayId) => flushSync(() => getCurrent().selectText(overlayId)),
    selectAudio: (trackId) => flushSync(() => getCurrent().selectAudio(trackId)),
    addSoundEffect: (effectId, aspect, signal) => {
      if (signal.aborted) throw signal.reason;
      flushSync(() => {
        if (getCurrent().history.present.activeVersion !== aspect) {
          getCurrent().dispatch({ type: "switch-aspect", aspect });
        }
        getCurrent().addSoundEffect(effectId, aspect);
      });
    },
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
