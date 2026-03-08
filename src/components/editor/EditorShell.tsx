"use client";

import dynamic from "next/dynamic";

const EditorApp = dynamic(
  () => import("@/components/editor/EditorApp").then((module) => module.EditorApp),
  {
    ssr: false,
  },
);

export const EditorShell = () => {
  return <EditorApp />;
};
