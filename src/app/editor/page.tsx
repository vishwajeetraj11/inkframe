import { EditorShell } from "@/components/editor/EditorShell";

export default function EditorPage() {
  const enableAIChat = Boolean(process.env.OPENAI_API_KEY?.trim());

  return <EditorShell enableAIChat={enableAIChat} />;
}
