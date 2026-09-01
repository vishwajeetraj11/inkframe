"use client";

import { useEffect, useRef, useState } from "react";

interface TemplateMotionPreviewProps {
  src: string;
  eager?: boolean;
}

export const TemplateMotionPreview = ({ src, eager = false }: TemplateMotionPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  const play = () => {
    if (reduceMotion) return;
    const video = videoRef.current;
    if (!video) return;
    void video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  };

  const pause = () => {
    videoRef.current?.pause();
    setIsPlaying(false);
  };

  useEffect(() => {
    if (reduceMotion) {
      videoRef.current?.pause();
    }
  }, [reduceMotion]);

  return (
    <div
      className="relative h-full w-full"
      onMouseEnter={play}
      onMouseLeave={pause}
    >
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        onPause={() => setIsPlaying(false)}
        preload={eager ? "metadata" : "none"}
        aria-hidden="true"
        className="h-full w-full object-cover opacity-85 saturate-[0.8] transition duration-500 ease-out group-hover:scale-[1.025] group-hover:opacity-100 group-hover:saturate-100 group-focus-visible:opacity-100"
      />
      <span className="absolute bottom-2 right-2 bg-[#16130f]/85 px-1.5 py-1 font-[family-name:var(--font-mono)] text-[8px] uppercase tracking-[0.1em] text-[#e9e3d7]">
        {reduceMotion ? (
          "Motion paused"
        ) : isPlaying ? (
          "Playing"
        ) : (
          <>
            <span className="sm:hidden">Tap to open</span>
            <span className="hidden sm:inline">Hover to preview</span>
          </>
        )}
      </span>
    </div>
  );
};
