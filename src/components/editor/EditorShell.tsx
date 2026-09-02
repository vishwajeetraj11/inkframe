"use client";

import dynamic from "next/dynamic";

interface EditorShellProps {
  enableAIChat: boolean;
}

const EditorApp = dynamic<EditorShellProps>(
  () => import("@/components/editor/EditorApp").then((module) => module.EditorApp),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-screen items-center justify-center bg-[#0f0d0a] px-6 text-neutral-100">
        <div role="status" aria-live="polite" className="w-full max-w-xl border-y border-white/10 py-8">
          <p className="app-eyebrow text-[10px] uppercase tracking-[0.2em] text-cyan-300">
            Loading workspace
          </p>
          <p className="app-title mt-3 text-4xl font-semibold uppercase leading-none">
            Preparing the cut<span className="text-cyan-300">.</span>
          </p>
          <div className="mt-6 h-px overflow-hidden bg-white/10">
            <div className="h-full w-1/3 bg-cyan-300 motion-safe:animate-pulse" />
          </div>
        </div>
      </main>
    ),
  },
);

export const EditorShell = ({
  enableAIChat,
}: EditorShellProps) => {
  return <EditorApp enableAIChat={enableAIChat} />;
};
