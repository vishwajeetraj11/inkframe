"use client";

import { useWebMcpTools, type WebMcpToolFactory } from "@/components/webmcp/use-webmcp-tools";
import type { AIEditorActions } from "@/lib/editor/ai-actions";
import type { EditorHistoryState } from "@/lib/editor/history";
import type { SoundEffectId } from "@/lib/editor/sound-effects";
import type { EditorAction } from "@/lib/editor/reducer";
import type { AspectPreset, AssetRef } from "@/lib/editor/types";
import { createEditorWebMcpTools } from "@/lib/editor/webmcp/tools";
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
  requestExport: (signal: AbortSignal) => Promise<{ ok: boolean; message: string }>;
  removeAsset: (assetId: string) => void;
  requestMediaPicker: () => void;
}

export const startEditorWebMcpExport = (
  requestExport: () => Promise<{ ok: boolean; message: string }>,
): { ok: boolean; message: string } => {
  void requestExport().catch(() => undefined);
  return {
    ok: true,
    message: "Export started. The MP4 download will begin when rendering completes.",
  };
};

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
    requestExport: () =>
      startEditorWebMcpExport(() =>
        getCurrent().requestExport(new AbortController().signal),
      ),
    removeAsset: (assetId, signal) => {
      if (signal.aborted) throw signal.reason;
      flushSync(() => getCurrent().removeAsset(assetId));
      return { ok: true, message: "Asset removed" };
    },
    requestMediaPicker: (signal) => {
      if (signal.aborted) throw signal.reason;
      getCurrent().requestMediaPicker();
    },
  });

export const useEditorWebMcp = (bridge: EditorWebMcpBridge): void => {
  useWebMcpTools(bridge, createTools);
};
