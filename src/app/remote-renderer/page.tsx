import { EditorShell } from "@/components/editor/EditorShell";

export default function RemoteRendererPage() {
  const enableAIChat = Boolean(process.env.OPENAI_API_KEY?.trim());
  const isVercelDeployment =
    Boolean(process.env.VERCEL?.trim()) && process.env.NODE_ENV === "production";

  return (
    <EditorShell
      enableAIChat={enableAIChat}
      isVercelDeployment={isVercelDeployment}
    />
  );
}
