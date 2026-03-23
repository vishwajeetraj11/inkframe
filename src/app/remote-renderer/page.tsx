import { EditorShell } from "@/components/editor/EditorShell";

export default function RemoteRendererPage() {
  const enableAIChat = Boolean(process.env.OPENAI_API_KEY?.trim());

  return <EditorShell enableAIChat={enableAIChat} />;
}
