"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Plus, Search, Square } from "lucide-react";
import type {
  LicensedAudioResult,
  LicensedAudioSearchResult,
} from "@/lib/stock-audio";

interface StockAudioAddResult {
  ok: boolean;
  message: string;
}

interface StockAudioPanelProps {
  onAdd?: (
    query: string,
    audio: LicensedAudioResult,
  ) => StockAudioAddResult | Promise<StockAudioAddResult>;
  disabled?: boolean;
  initialQuery?: string;
}

const DEBOUNCE_MS = 350;

const formatDuration = (seconds: number): string => {
  const wholeSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
};

export const StockAudioPanel = ({
  onAdd,
  disabled = false,
  initialQuery = "",
}: StockAudioPanelProps) => {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<LicensedAudioSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const requestController = useRef<AbortController | null>(null);
  const previewAudio = useRef<HTMLAudioElement | null>(null);

  const stopPreview = useCallback(() => {
    const audio = previewAudio.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    }
    previewAudio.current = null;
    setPreviewingId(null);
    setIsPreviewPlaying(false);
    setPreviewProgress(0);
  }, []);

  const search = useCallback(async (rawQuery: string) => {
    const trimmedQuery = rawQuery.trim();
    requestController.current?.abort();
    if (trimmedQuery.length < 2) {
      setResult(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    requestController.current = controller;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ query: trimmedQuery });
      const response = await fetch(`/api/stock-audio/sfx?${params.toString()}`, {
        signal: controller.signal,
      });
      const payload = (await response.json()) as LicensedAudioSearchResult | { error?: string };
      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Sound-effect search failed.",
        );
      }
      if (!controller.signal.aborted) {
        setResult(payload as LicensedAudioSearchResult);
      }
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setResult(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Sound-effect search failed.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void search(query), DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      requestController.current?.abort();
    };
  }, [query, search]);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const togglePreview = (audioResult: LicensedAudioResult) => {
    const currentAudio = previewAudio.current;
    if (previewingId === audioResult.id && currentAudio) {
      if (currentAudio.paused) {
        void currentAudio.play().then(() => setIsPreviewPlaying(true)).catch(() => {
          setError("This preview could not be played.");
        });
      } else {
        currentAudio.pause();
        setIsPreviewPlaying(false);
      }
      return;
    }

    stopPreview();
    const audio = new Audio(audioResult.audioUrl);
    audio.preload = "metadata";
    audio.volume = 0.7;
    audio.addEventListener("timeupdate", () => {
      setPreviewProgress(
        Number.isFinite(audio.duration) && audio.duration > 0
          ? Math.min(1, audio.currentTime / audio.duration)
          : 0,
      );
    });
    audio.addEventListener("ended", stopPreview, { once: true });
    audio.addEventListener("error", () => {
      stopPreview();
      setError("This preview could not be played.");
    }, { once: true });
    previewAudio.current = audio;
    setPreviewingId(audioResult.id);
    setPreviewProgress(0);
    void audio.play().then(() => setIsPreviewPlaying(true)).catch(() => {
      stopPreview();
      setError("This preview could not be played.");
    });
  };

  const handleAdd = async (audio: LicensedAudioResult) => {
    if (!onAdd) return;
    setAddingId(audio.id);
    setError(null);
    try {
      const outcome = await onAdd(query.trim(), audio);
      if (!outcome.ok) throw new Error(outcome.message);
    } catch (addError) {
      setError(
        addError instanceof Error
          ? addError.message
          : "Could not add this sound effect.",
      );
    } finally {
      setAddingId(null);
    }
  };

  return (
    <section className="px-3 pb-4 pt-3" aria-label="Stock sound effects">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="app-eyebrow text-[9px] uppercase tracking-[0.18em] text-neutral-400">
            Quick import
          </p>
          <h3 className="app-title text-sm font-semibold uppercase text-neutral-50">
            Sound effects
          </h3>
        </div>
        <span className="app-data mt-0.5 text-[9px] uppercase text-neutral-500">
          Freesound / CC
        </span>
      </div>

      <div className="relative">
        <label htmlFor="stock-audio-search" className="sr-only">
          Search stock sound effects
        </label>
        <input
          id="stock-audio-search"
          type="search"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search whooshes, hits, ambience"
          className="h-10 w-full border border-white/15 bg-white/[0.035] px-3 pr-10 text-xs text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-[#ff4f1f]"
        />
        <Search
          aria-hidden="true"
          size={14}
          strokeWidth={1.7}
          className={`pointer-events-none absolute right-3 top-3 ${isLoading ? "animate-pulse text-[#ff9b7d]" : "text-neutral-500"}`}
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-3 border border-rose-300/25 bg-rose-300/[0.05] px-3 py-2 text-[11px] leading-4 text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {query.trim().length < 2 && !isLoading ? (
        <p className="mt-3 border-l border-[#ff4f1f]/60 pl-2 text-[11px] leading-4 text-neutral-400">
          Find short, remix-safe effects. Preview first, then add them directly to the audio track.
        </p>
      ) : null}

      {isLoading && !result ? (
        <div className="mt-3 divide-y divide-white/10" aria-label="Loading sound effects" aria-busy="true">
          {["one", "two", "three", "four"].map((item) => (
            <div key={item} className="flex h-16 items-center gap-2">
              <span className="h-8 w-8 animate-pulse bg-white/[0.06]" />
              <span className="h-3 flex-1 animate-pulse bg-white/[0.06]" />
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && result && result.results.length === 0 ? (
        <div className="mt-3 border border-dashed border-white/15 px-3 py-4 text-[11px] leading-4 text-neutral-400">
          No licensed effects matched “{query.trim()}”. Try a simpler sound description.
        </div>
      ) : null}

      {result && result.results.length > 0 ? (
        <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
          {result.results.map((audio) => {
            const isActive = previewingId === audio.id;
            const isAdding = addingId === audio.id;
            return (
              <article key={audio.id} className="relative py-2.5">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => togglePreview(audio)}
                    aria-label={`${isActive && isPreviewPlaying ? "Pause" : "Preview"} ${audio.title}`}
                    title={isActive && isPreviewPlaying ? "Pause preview" : "Play preview"}
                    className="grid h-8 w-8 shrink-0 place-items-center bg-white/[0.06] text-neutral-100 outline-none transition hover:bg-white/[0.11] focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:opacity-40"
                  >
                    {isActive && isPreviewPlaying ? (
                      <Pause aria-hidden="true" size={14} fill="currentColor" strokeWidth={1.5} />
                    ) : (
                      <Play aria-hidden="true" size={14} fill="currentColor" strokeWidth={1.5} />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-neutral-100" title={audio.title}>
                      {audio.title}
                    </p>
                    <p className="app-data mt-0.5 flex items-center gap-1.5 text-[9px] text-neutral-500">
                      <span>{formatDuration(audio.durationSeconds)}</span>
                      <span aria-hidden="true">·</span>
                      <a
                        href={audio.creatorUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="max-w-20 truncate hover:text-neutral-300"
                      >
                        {audio.creatorName}
                      </a>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[8px] uppercase tracking-[0.08em]">
                      <a
                        href={audio.licenseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#ff9b7d] hover:text-[#ffc1ae]"
                      >
                        {audio.licenseName}
                      </a>
                      <span className="text-neutral-500">
                        {audio.attributionRequired ? "Credit required" : "No credit required"}
                      </span>
                    </p>
                  </div>

                  {isActive ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={stopPreview}
                      aria-label={`Stop ${audio.title}`}
                      title="Stop preview"
                      className="grid h-8 w-8 shrink-0 place-items-center text-neutral-400 outline-none transition hover:bg-white/[0.06] hover:text-neutral-100 focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:opacity-40"
                    >
                      <Square aria-hidden="true" size={12} fill="currentColor" strokeWidth={1.5} />
                    </button>
                  ) : null}

                  {onAdd ? (
                    <button
                      type="button"
                      disabled={disabled || isAdding}
                      onClick={() => void handleAdd(audio)}
                      aria-label={`Add ${audio.title}`}
                      title={isAdding ? "Adding sound effect" : "Add sound effect"}
                      className="grid h-8 w-8 shrink-0 place-items-center border border-[#ff4f1f]/55 text-[#ffb19a] outline-none transition hover:bg-[#ff4f1f]/10 focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:cursor-wait disabled:opacity-50"
                    >
                      {isAdding ? (
                        <span aria-hidden="true" className="text-sm leading-none">…</span>
                      ) : (
                        <Plus aria-hidden="true" size={16} strokeWidth={1.8} />
                      )}
                    </button>
                  ) : null}
                </div>

                {isActive ? (
                  <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" aria-hidden="true">
                    <span
                      className="block h-full origin-left bg-[#ff4f1f] transition-transform duration-100"
                      style={{ transform: `scaleX(${previewProgress})` }}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {result && result.results.length > 0 ? (
        <p className="mt-4 text-[9px] leading-4 text-neutral-500">
          Audio from{" "}
          <a
            href="https://freesound.org/"
            target="_blank"
            rel="noreferrer"
            className="text-neutral-300 hover:text-neutral-100"
          >
            Freesound
          </a>
          . Only CC0 and CC BY results are shown; source and credit details stay attached after import.
        </p>
      ) : null}
    </section>
  );
};

export type { StockAudioAddResult, StockAudioPanelProps };
