"use client";

import {
  parseAIEditorActionsFromMessage,
  type AIEditorActions,
} from "@/lib/editor/ai-actions";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const RENDER_DIRECTIVE = "[[RENDER_VIDEO]]";

interface RenderRequestResult {
  ok: boolean;
  message: string;
}

export interface AIChatEditorContext {
  activeAspect: "reel_9_16" | "widescreen_16_9";
  timelineDurationInFrames: number;
  timelineDurationSeconds: number;
  clipCount: number;
  textOverlayCount: number;
  audioTrackCount: number;
  assetCount: number;
}

interface AIChatDrawerProps {
  editorContext?: AIChatEditorContext;
  onApplyEditorActions?: (
    actions: AIEditorActions,
  ) => Promise<RenderRequestResult>;
  onRenderVideoRequest?: () => Promise<RenderRequestResult>;
}

const isStreamingStatus = (status: string): boolean =>
  status === "submitted" || status === "streaming";

const stripRenderDirective = (text: string): string =>
  text.replaceAll(RENDER_DIRECTIVE, "").trim();

const hasRenderDirective = (text: string): boolean =>
  text.includes(RENDER_DIRECTIVE);

const waitForUiCommit = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const getMessageRawText = (message: UIMessage): string => {
  const parts = message.parts ?? [];
  return parts
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }

      return "";
    })
    .join("")
    .trim();
};

const messageToText = (message: UIMessage): string => {
  const text = getMessageRawText(message);
  const withoutRenderDirective = stripRenderDirective(text);
  const { cleanedText } = parseAIEditorActionsFromMessage(withoutRenderDirective);
  const cleaned = cleanedText.trim();
  return cleaned.length > 0 ? cleaned : "";
};

export const AIChatDrawer = ({
  editorContext,
  onApplyEditorActions,
  onRenderVideoRequest,
}: AIChatDrawerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const handledDirectiveMessageIds = useRef<Set<string>>(new Set());

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: editorContext ? { editorContext } : {},
      }),
    [editorContext],
  );

  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    transport,
    onFinish: async ({ message }) => {
      if (handledDirectiveMessageIds.current.has(message.id)) {
        return;
      }

      handledDirectiveMessageIds.current.add(message.id);
      const rawText = getMessageRawText(message);
      const parsedActions = parseAIEditorActionsFromMessage(rawText);

      if (parsedActions.parseError) {
        setActionMessage(parsedActions.parseError);
        return;
      }

      if (parsedActions.actions && onApplyEditorActions) {
        setActionMessage("Applying AI edits...");

        try {
          const applyResult = await onApplyEditorActions(parsedActions.actions);
          setActionMessage(applyResult.message);

          if (!applyResult.ok) {
            return;
          }

          await waitForUiCommit();
        } catch (applyError) {
          const applyMessage =
            applyError instanceof Error
              ? applyError.message
              : "Failed to apply AI edits.";
          setActionMessage(applyMessage);
          return;
        }
      }

      if (!onRenderVideoRequest || !hasRenderDirective(rawText)) {
        return;
      }

      setActionMessage("AI requested render. Starting export...");

      try {
        const result = await onRenderVideoRequest();
        setActionMessage(result.message);
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Render request failed.";
        setActionMessage(message);
      }
    },
  });

  const isStreaming = isStreamingStatus(status);
  const contextLabel = useMemo(() => {
    if (!editorContext) {
      return "Streaming via OpenAI";
    }

    return `Timeline ${editorContext.timelineDurationSeconds.toFixed(
      2,
    )}s • ${editorContext.clipCount} clips • ${editorContext.textOverlayCount} text`;
  }, [editorContext]);

  const renderedMessages = useMemo(
    () =>
      messages
        .map((message) => ({
          id: message.id,
          role: message.role,
          text: messageToText(message),
        }))
        .filter((message) => message.text.length > 0),
    [messages],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [renderedMessages, isStreaming, isOpen]);

  const sendCurrentMessage = async (): Promise<void> => {
    const nextInput = input.trim();
    if (nextInput.length === 0 || isStreaming) {
      return;
    }

    setInput("");
    await sendMessage({ text: nextInput });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await sendCurrentMessage();
  };

  const onTextareaKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ): void => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void sendCurrentMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <section className="flex h-[30rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-neutral-700/90 bg-neutral-950/95 backdrop-blur">
          <header className="flex items-center justify-between border-b border-neutral-700 px-4 py-3">
            <div>
              <h2 className="app-panel-label text-sm font-semibold uppercase tracking-wide text-neutral-100">
                AI Chat
              </h2>
              <p className="app-data text-xs text-neutral-400">{contextLabel}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setActionMessage(null);
                  handledDirectiveMessageIds.current.clear();
                }}
                className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                aria-label="Collapse AI chat"
              >
                Collapse
              </button>
            </div>
          </header>

          <div ref={scrollContainerRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {renderedMessages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/60 p-3 text-xs text-neutral-400">
                Ask for script ideas, hooks, shot lists, caption options, or timeline edits.
              </div>
            ) : (
              renderedMessages.map((message) => {
                const isAssistant = message.role === "assistant";

                return (
                  <article
                    key={message.id}
                    className={`max-w-[95%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      isAssistant
                        ? "mr-auto bg-neutral-800 text-neutral-100"
                        : "ml-auto bg-cyan-300 text-neutral-950"
                    }`}
                  >
                    {message.text}
                  </article>
                );
              })
            )}

            {isStreaming ? (
              <p className="text-xs text-neutral-400">Thinking...</p>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error.message}
              </p>
            ) : null}

            {actionMessage ? (
              <p className="rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-xs text-neutral-300">
                {actionMessage}
              </p>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="space-y-2 border-t border-neutral-700 p-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              onKeyDown={onTextareaKeyDown}
              disabled={isStreaming}
              rows={3}
              placeholder="Ask AI for edit help..."
              className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-cyan-300"
            />

            <p className="text-[11px] text-neutral-500">
              Shortcut: Ctrl+Enter (Cmd+Enter on Mac) to send
            </p>

            <div className="flex items-center justify-end gap-2">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={() => void stop()}
                  className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-200"
                >
                  Stop
                </button>
              ) : null}

              <button
                type="submit"
                disabled={isStreaming || input.trim().length === 0}
                className="rounded-md bg-cyan-300 px-3 py-1.5 text-xs font-semibold text-neutral-950 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-full border border-neutral-700 bg-neutral-900/90 px-4 py-2 text-sm font-semibold text-neutral-100 transition hover:bg-neutral-800/90"
        >
          Open AI Chat
        </button>
      )}
    </div>
  );
};
