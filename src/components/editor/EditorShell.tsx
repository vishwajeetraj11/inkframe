"use client";

import dynamic from "next/dynamic";

interface EditorShellProps {
  enableAIChat: boolean;
  isVercelDeployment: boolean;
}

const EditorApp = dynamic<EditorShellProps>(
  () => import("@/components/editor/EditorApp").then((module) => module.EditorApp),
  {
    ssr: false,
  },
);

export const EditorShell = ({
  enableAIChat,
  isVercelDeployment,
}: EditorShellProps) => {
  return (
    <EditorApp
      enableAIChat={enableAIChat}
      isVercelDeployment={isVercelDeployment}
    />
  );
};
