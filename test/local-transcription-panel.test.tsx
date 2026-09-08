import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LocalTranscriptionPanel } from "@/components/editor/features/LocalTranscriptionPanel";
import { createDefaultClip } from "@/lib/editor/defaults";
import type { VersionTimeline } from "@/lib/editor/types";
import type { EditorAction } from "@/lib/editor/reducer";
import { prepareTranscriptionAudio } from "@/lib/export/transcription-audio";
import { downloadTranscriptionAudio } from "@/lib/export/transcription-download";
vi.mock("@/lib/export/transcription-audio", () => ({ prepareTranscriptionAudio: vi.fn() }));
vi.mock("@/lib/export/transcription-download", () => ({ downloadTranscriptionAudio: vi.fn() }));
const clip = { ...createDefaultClip("source", "asset", "video"), startFrame: 90, endFrame: 150, trimStartFrame: 30, trimEndFrame: 90 };
const version: VersionTimeline = { aspect: "reel_9_16", clips: [clip], textOverlays: [], audioTracks: [], transitions: [] };
const content = JSON.stringify({ segments: [{ start: 0, end: 1, text: "Hello there" }] });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function setup() {
  vi.mocked(prepareTranscriptionAudio).mockResolvedValue({ blob: new Blob(["wav"]), filename: "source.wav", durationSeconds: 2 });
  const onEdit = vi.fn((_action: EditorAction) => { void _action; return true; });
  const result = render(<LocalTranscriptionPanel clip={clip} version={version} sourceUrl="blob:source" onEdit={onEdit} />);
  fireEvent.click(screen.getByText("Local transcription", { exact: true }));
  return { ...result, onEdit };
}
async function preview() {
  fireEvent.click(screen.getByRole("button", { name: "1. Download audio for Whisper" }));
  await screen.findByLabelText("Whisper JSON");
  fireEvent.change(screen.getByLabelText("Whisper JSON"), { target: { value: content } });
  fireEvent.click(screen.getByRole("button", { name: "Preview caption timing" }));
}
describe("local transcription handoff panel", () => {
  it("downloads audio, previews timeline timing, and requires review before one edit", async () => {
    const { onEdit } = setup(); await preview();
    expect(downloadTranscriptionAudio).toHaveBeenCalledOnce();
    expect(screen.getByText("3.00–4.00s")).toBeInTheDocument();
    const apply = screen.getByRole("button", { name: "3. Add reviewed captions" });
    expect(apply).toBeDisabled(); expect(onEdit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(apply);
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onEdit.mock.calls[0]?.[0]).toMatchObject({ type: "replace-version", version: { captionCues: [{ text: "Hello there", startFrame: 90, endFrame: 120 }] } });
  });
  it("invalidates the review when transcript text changes", async () => {
    setup(); await preview(); fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Whisper JSON"), { target: { value: "bad json" } });
    expect(screen.queryByRole("button", { name: "3. Add reviewed captions" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview caption timing" }));
    expect(screen.getByRole("alert")).toHaveTextContent("not valid JSON");
  });
  it("cancels pending preparation on unmount without a late download", async () => {
    const { unmount } = setup();
    let finish!: (value: Awaited<ReturnType<typeof prepareTranscriptionAudio>>) => void;
    vi.mocked(prepareTranscriptionAudio).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "1. Download audio for Whisper" }));
    const signal = vi.mocked(prepareTranscriptionAudio).mock.calls[0][0].signal!;
    unmount(); expect(signal.aborted).toBe(true);
    finish({ blob: new Blob(), filename: "late.wav", durationSeconds: 2 });
    await waitFor(() => expect(downloadTranscriptionAudio).not.toHaveBeenCalled());
  });
});
