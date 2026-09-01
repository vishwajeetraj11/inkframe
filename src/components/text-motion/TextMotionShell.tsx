"use client";

import dynamic from "next/dynamic";

const TextMotionEditor = dynamic(
  () => import("@/components/text-motion/TextMotionEditor").then((module) => module.TextMotionEditor),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-screen items-center justify-center bg-[#0f0d0a] px-6 text-[#f2ede3]">
        <div role="status" aria-live="polite" className="w-full max-w-xl border-y border-[#f2ede3]/15 py-8">
          <p className="app-eyebrow text-[10px] uppercase tracking-[0.2em] text-[#ff4f1f]">
            Loading text motion
          </p>
          <p className="app-title mt-3 text-4xl font-semibold uppercase leading-none">
            Setting the rhythm<span className="text-[#ff4f1f]">.</span>
          </p>
          <div className="mt-6 h-px overflow-hidden bg-[#f2ede3]/10">
            <div className="h-full w-1/3 bg-[#ff4f1f] motion-safe:animate-pulse" />
          </div>
        </div>
      </main>
    ),
  },
);

export const TextMotionShell = () => {
  return <TextMotionEditor />;
};
