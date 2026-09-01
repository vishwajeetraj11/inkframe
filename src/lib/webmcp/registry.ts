import { getWebMCPModelContext } from "./capabilities";
import type {
  WebMCPDocument,
  WebMCPModelContext,
  WebMCPTool,
} from "./types";

export interface WebMCPRegistration {
  registered: string[];
  failed: Array<{ tool: WebMCPTool; error: unknown }>;
  cleanup: () => Promise<void>;
}

export interface RegisterWebMCPToolsOptions {
  document?: WebMCPDocument | null;
  modelContext?: WebMCPModelContext | null;
  signal?: AbortSignal;
}

/**
 * Register every tool independently. Unsupported environments resolve to an
 * empty registration, making this safe to call from SSR and older browsers.
 */
export async function registerWebMCPTools(
  tools: readonly WebMCPTool[],
  options: RegisterWebMCPToolsOptions = {},
): Promise<WebMCPRegistration> {
  const context =
    options.modelContext ??
    getWebMCPModelContext(
      options.document ??
        (typeof document !== "undefined" ? (document as WebMCPDocument) : null),
    );
  const controller = options.signal ? null : new AbortController();
  const signal = options.signal ?? controller!.signal;
  const registered: string[] = [];
  const failed: WebMCPRegistration["failed"] = [];

  if (context) {
    const results = await Promise.all(
      tools.map(async (tool) => {
        try {
          await context.registerTool(tool, { signal });
          registered.push(tool.name);
        } catch (error) {
          failed.push({ tool, error });
        }
      }),
    );
    void results;
  }

  let cleaned = false;
  return {
    registered,
    failed,
    cleanup: async () => {
      if (cleaned) return;
      cleaned = true;
      controller?.abort();
      if (!context?.unregisterTool) return;
      await Promise.allSettled(registered.map((name) => context.unregisterTool!(name)));
    },
  };
}
