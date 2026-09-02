"use client";

import {
  Preview,
  createDefaultDemuxerFactory,
  usePlaybackStore,
} from "@elah/editor";
import { useMemo } from "react";
import { ElahEditorProvider } from "@/components/editor/elah";
import { toElahTextMotionProject } from "@/lib/text-motion/elah-adapter";
import type { TextMotionProject } from "@/lib/text-motion/types";

const PlaybackControls = ({ fps, totalFrames }: { fps: number; totalFrames: number }) => {
  const currentFrame = usePlaybackStore((state) => state.currentFrame);
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const togglePlayPause = usePlaybackStore((state) => state.togglePlayPause);

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex min-h-11 items-center gap-3 border-t border-white/10 bg-black/75 px-3 backdrop-blur-sm">
      <button
        type="button"
        onClick={togglePlayPause}
        className="min-h-9 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#ff4f1f]"
      >
        {isPlaying ? "Pause" : "Play"}
      </button>
      <span className="app-data text-[10px] text-white/70">
        {(currentFrame / fps).toFixed(2)} / {(totalFrames / fps).toFixed(2)}s
      </span>
      <span className="ml-auto app-data text-[9px] uppercase tracking-[0.1em] text-[#ff8a68]">
        Elah browser preview
      </span>
    </div>
  );
};

export const ElahTextMotionPreview = ({ project }: { project: TextMotionProject }) => {
  const elahProject = useMemo(() => toElahTextMotionProject(project), [project]);
  const demuxerFactory = useMemo(() => createDefaultDemuxerFactory(), []);
  const totalFrames = project.scenes.reduce(
    (sum, scene) => sum + scene.durationInFrames,
    0,
  );

  return (
    <ElahEditorProvider className="h-full" project={elahProject}>
      <Preview
        demuxerFactory={demuxerFactory}
        className="h-full w-full"
        style={{ height: "100%", width: "100%", pointerEvents: "none" }}
      />
      <PlaybackControls fps={elahProject.fps} totalFrames={totalFrames} />
    </ElahEditorProvider>
  );
};
