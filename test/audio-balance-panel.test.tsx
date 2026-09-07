import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioBalancePanel } from "@/components/editor/features/AudioBalancePanel";
import { createDefaultAudioTrack, createEmptyVersionTimeline } from "@/lib/editor/defaults";
import type { EditorAction } from "@/lib/editor/reducer";

afterEach(cleanup);
const version = {
  ...createEmptyVersionTimeline("reel_9_16"),
  audioTracks: [
    { ...createDefaultAudioTrack("music", "music-file"), startFrame: 0, endFrame: 300, volume: 1 },
    { ...createDefaultAudioTrack("voice", "voice-file"), startFrame: 60, endFrame: 180, volume: 1 },
  ],
};
const selectSources = () => {
  fireEvent.change(screen.getByLabelText("Music to lower"), { target: { value: "audio:music" } });
  fireEvent.change(screen.getByLabelText("Narration to keep clear"), { target: { value: "audio:voice" } });
  fireEvent.click(screen.getByRole("button", { name: "Preview volume envelope" }));
};

describe("Audio balance panel", () => {
  it("previews without edits and applies one owned rule with a targeted undo", () => {
    const onEdit = vi.fn<(action: EditorAction) => boolean>(() => true);
    const view = render(<AudioBalancePanel version={version} assetNames={{}} onEdit={onEdit} />);
    selectSources();
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: /Planned music volume envelope/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply balance" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    const action = onEdit.mock.calls[0][0];
    if (action.type !== "set-ducking-rule") throw new Error("Expected balance rule");
    view.rerender(<AudioBalancePanel version={{ ...version, duckingRules: [action.rule] }} assetNames={{}} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: "Undo balance" }));
    expect(onEdit).toHaveBeenLastCalledWith({ type: "remove-ducking-rule", aspect: version.aspect, ruleId: action.rule.id });
  });

  it("does not undo a rule changed elsewhere", () => {
    const onEdit = vi.fn<(action: EditorAction) => boolean>(() => true);
    const view = render(<AudioBalancePanel version={version} assetNames={{}} onEdit={onEdit} />);
    selectSources(); fireEvent.click(screen.getByRole("button", { name: "Apply balance" }));
    const action = onEdit.mock.calls[0][0];
    if (action.type !== "set-ducking-rule") throw new Error("Expected balance rule");
    view.rerender(<AudioBalancePanel version={{ ...version, duckingRules: [{ ...action.rule, attenuationDb: -3 }] }} assetNames={{}} onEdit={onEdit} />);
    expect((screen.getByRole("button", { name: "Undo balance" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/changed elsewhere/)).toBeTruthy();
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("invalidates a preview on timeline changes and clears it on aspect switches", () => {
    const onEdit = vi.fn(() => true);
    const view = render(<AudioBalancePanel version={version} assetNames={{}} onEdit={onEdit} />);
    selectSources();
    view.rerender(<AudioBalancePanel version={{ ...version }} assetNames={{}} onEdit={onEdit} />);
    expect(screen.queryByRole("button", { name: "Apply balance" })).toBeNull();
    expect(screen.getByText(/timeline changed/)).toBeTruthy();
    view.rerender(<AudioBalancePanel version={{ ...version, aspect: "widescreen_16_9" }} assetNames={{}} onEdit={onEdit} />);
    expect((screen.getByLabelText("Music to lower") as HTMLSelectElement).value).toBe("");
  });

  it("reports inaudible sources without applying", () => {
    const onEdit = vi.fn(() => true);
    render(<AudioBalancePanel version={{ ...version, audioTracks: version.audioTracks.map((track) => ({ ...track, volume: 0 })) }} assetNames={{}} onEdit={onEdit} />);
    selectSources();
    expect(screen.getByRole("status").textContent).toContain("not audible");
    expect(onEdit).not.toHaveBeenCalled();
  });
});
