/** The JSON-schema-shaped input definition accepted by WebMCP tools. */
export type WebMCPInputSchema = Record<string, unknown>;

export interface WebMCPToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface WebMCPExecuteOptions {
  signal?: AbortSignal;
}

/**
 * Some WebMCP preview hosts invoke tools without an execution context. Keep
 * cancellation support when supplied, while remaining compatible with those
 * callers.
 */
export const getWebMCPExecuteSignal = (
  options?: WebMCPExecuteOptions,
): AbortSignal => options?.signal ?? new AbortController().signal;

export interface WebMCPTool<Input = unknown> {
  name: string;
  title?: string;
  description: string;
  inputSchema: WebMCPInputSchema;
  annotations?: WebMCPToolAnnotations;
  execute: (input: Input, options?: WebMCPExecuteOptions) => string | Promise<string>;
}

/** Conventional casing alias for consumers that prefer `Mcp` in type names. */
export type WebMcpTool<Input = unknown> = WebMCPTool<Input>;

export interface WebMCPRegisterOptions {
  signal?: AbortSignal;
}

export interface WebMCPModelContext {
  registerTool: (
    tool: WebMCPTool,
    options?: WebMCPRegisterOptions,
  ) => void | Promise<void>;
  unregisterTool?: (name: string) => void | Promise<void>;
}

export interface WebMCPDocument extends Document {
  modelContext?: WebMCPModelContext;
}
