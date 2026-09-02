import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StockAudioPanel } from "@/components/editor/stock/StockAudioPanel";
import type { LicensedAudioResult } from "@/lib/stock-audio";

const effect: LicensedAudioResult = {
  id: "98",
  provider: "freesound",
  title: "Fast cinematic whoosh",
  creatorName: "Sound Maker",
  creatorUrl: "https://freesound.org/people/Sound%20Maker/",
  sourceUrl: "https://freesound.org/s/98/",
  audioUrl: "https://cdn.freesound.org/98.mp3",
  durationSeconds: 1.2,
  licenseName: "CC BY",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  attributionRequired: true,
  tags: ["whoosh", "transition"],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StockAudioPanel", () => {
  it("searches Freesound and imports a licensed result with visible credit requirements", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({
        provider: "freesound",
        query: "whoosh",
        results: [effect],
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetcher);
    const onAdd = vi.fn(async () => ({ ok: true, message: "Imported" }));

    render(<StockAudioPanel initialQuery="whoosh" onAdd={onAdd} />);

    expect(await screen.findByText("Fast cinematic whoosh", {}, { timeout: 2_000 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CC BY" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by/4.0/",
    );
    expect(screen.getByText("Credit required")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Fast cinematic whoosh" }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("whoosh", effect));
    expect(fetcher).toHaveBeenCalledWith(
      "/api/stock-audio/sfx?query=whoosh",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("teaches the licensing boundary before a search", () => {
    render(<StockAudioPanel />);

    expect(screen.getByText(/remix-safe effects/i)).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search stock sound effects" })).toBeEnabled();
  });
});
