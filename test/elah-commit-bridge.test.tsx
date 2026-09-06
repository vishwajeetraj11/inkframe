import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ElahEditorProvider } from "@/components/editor/elah/ElahEditorProvider";
import { toElahProject } from "@/lib/editor/elah-adapter";
import { createInitialProjectSession } from "@/lib/editor/defaults";

const state = vi.hoisted(() => ({
  project: null as unknown,
  listeners: new Map<string, Set<(...args: unknown[]) => void>>(),
}));
vi.mock("@elah/editor", () => ({
  EditorProvider: ({ children }: { children: ReactNode }) => children,
  useTimelineEngine: () => engine,
}));
const emit = (event: string) => state.listeners.get(event)?.forEach((callback) => callback(state.project));
const engine = {
  getProject: () => state.project,
  loadProject: (project: unknown) => { state.project = project; emit("change"); emit("history:change"); },
  on: (event: string, callback: (...args: unknown[]) => void) => {
    if (!state.listeners.has(event)) state.listeners.set(event, new Set());
    state.listeners.get(event)!.add(callback);
  },
  off: (event: string, callback: (...args: unknown[]) => void) => state.listeners.get(event)?.delete(callback),
};
afterEach(() => { cleanup(); state.listeners.clear(); state.project = null; });

describe("Elah canonical commit bridge", () => {
  it("keeps gesture previews local and publishes the completed gesture exactly once", () => {
    const initial = toElahProject(createInitialProjectSession().versions.reel_9_16).project;
    const changed = { ...initial, name: "After gesture" };
    const onChange = vi.fn();
    const view = render(<ElahEditorProvider project={initial} onProjectChange={onChange}><div /></ElahEditorProvider>);
    expect(onChange).not.toHaveBeenCalled();
    act(() => { state.project = changed; emit("change"); emit("change"); });
    expect(onChange).not.toHaveBeenCalled();
    act(() => emit("history:change"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(changed);
    view.rerender(<ElahEditorProvider project={{ ...initial }} onProjectChange={onChange}><div /></ElahEditorProvider>);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
