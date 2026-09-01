import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWebMcpTools, type WebMcpToolFactory } from "@/components/webmcp/use-webmcp-tools";
import type { WebMCPModelContext, WebMcpTool } from "@/lib/webmcp/types";

const originalModelContext = Object.getOwnPropertyDescriptor(document, "modelContext");

afterEach(() => {
  if (originalModelContext) {
    Object.defineProperty(document, "modelContext", originalModelContext);
  } else {
    Reflect.deleteProperty(document, "modelContext");
  }
});

const createTools: WebMcpToolFactory<{ value: string }> = (getCurrent) => [
  {
    name: "test_get_value",
    title: "Get value",
    description: "Read the current test value.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => JSON.stringify({ value: getCurrent().value }),
  },
];

const Harness = ({ value }: { value: string }) => {
  useWebMcpTools({ value }, createTools);
  return null;
};

describe("useWebMcpTools", () => {
  it("registers once, reads current React state, and aborts on unmount", async () => {
    let registeredTool: WebMcpTool | null = null;
    let registrationSignal: AbortSignal | undefined;
    const registerTool = vi.fn(async (tool: WebMcpTool, options?: { signal?: AbortSignal }) => {
      registeredTool = tool;
      registrationSignal = options?.signal;
    });
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: { registerTool } satisfies WebMCPModelContext,
    });

    const view = render(<Harness value="first" />);
    await waitFor(() => expect(registerTool).toHaveBeenCalledTimes(1));

    view.rerender(<Harness value="second" />);
    expect(registerTool).toHaveBeenCalledTimes(1);
    await expect(
      registeredTool!.execute({}, { signal: new AbortController().signal }),
    ).resolves.toBe('{"value":"second"}');

    act(() => view.unmount());
    expect(registrationSignal?.aborted).toBe(true);
  });
});
