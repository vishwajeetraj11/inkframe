"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  chooseMp4Rendition,
  type PexelsOrientation,
  type PexelsVideoResult,
  type PexelsVideoRendition,
  type PexelsVideoSearchResult,
} from "@/lib/pexels";

interface StockVideoPanelProps {
  orientation?: Exclude<PexelsOrientation, "square">;
  onPreview?: (video: PexelsVideoResult) => void;
  onAdd?: (video: PexelsVideoResult, rendition: PexelsVideoRendition) => void | Promise<void>;
  disabled?: boolean;
  initialQuery?: string;
}

const DEBOUNCE_MS = 350;
const PAGE_SIZE = 18;

const formatDuration = (seconds: number): string => {
  const wholeSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
};

const formatResolution = (video: PexelsVideoResult): string =>
  `${video.width} × ${video.height}`;

export const StockVideoPanel = ({
  orientation = "landscape",
  onPreview,
  onAdd,
  disabled = false,
  initialQuery = "",
}: StockVideoPanelProps) => {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<PexelsVideoSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);
  const requestController = useRef<AbortController | null>(null);

  const search = useCallback(async (rawQuery: string) => {
    const trimmedQuery = rawQuery.trim();
    requestController.current?.abort();
    if (trimmedQuery.length === 0) {
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
      const params = new URLSearchParams({
        query: trimmedQuery,
        orientation,
        page: "1",
        per_page: String(PAGE_SIZE),
      });
      const response = await fetch(`/api/pexels/videos?${params.toString()}`, {
        signal: controller.signal,
      });
      const payload = (await response.json()) as PexelsVideoSearchResult | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Stock search failed.");
      }
      if (!controller.signal.aborted) setResult(payload as PexelsVideoSearchResult);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      if (requestError instanceof Error && requestError.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setResult(null);
        setError(requestError instanceof Error ? requestError.message : "Stock search failed.");
      }
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [orientation]);

  useEffect(() => {
    const timer = window.setTimeout(() => void search(query), DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      requestController.current?.abort();
    };
  }, [query, search]);

  const handleAdd = async (video: PexelsVideoResult) => {
    const rendition = chooseMp4Rendition(video.renditions, orientation === "portrait"
      ? { width: 1080, height: 1920 }
      : { width: 1920, height: 1080 });
    if (!rendition || !onAdd) return;
    setAddingId(video.id);
    try {
      await onAdd(video, rendition);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Could not add this footage.");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <section className="border-t border-white/10 px-3 pb-4 pt-3" aria-label="Stock footage">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="app-eyebrow text-[9px] uppercase tracking-[0.18em] text-neutral-400">
            Quick import
          </p>
          <h3 className="app-title text-sm font-semibold uppercase text-neutral-50">
            Stock footage
          </h3>
        </div>
        <span className="app-data mt-0.5 text-[9px] uppercase text-neutral-500">
          Pexels / {orientation}
        </span>
      </div>

      <div className="relative">
        <label htmlFor="stock-video-search" className="sr-only">Search stock footage</label>
        <input
          id="stock-video-search"
          type="search"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={orientation === "portrait" ? "Search vertical footage" : "Search b-roll"}
          className="h-10 w-full border border-white/15 bg-white/[0.035] px-3 pr-10 text-xs text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-[#ff4f1f]"
        />
        <span aria-hidden="true" className="pointer-events-none absolute right-3 top-2.5 text-xs text-neutral-500">
          {isLoading ? "…" : "⌕"}
        </span>
      </div>

      {error ? (
        <div role="alert" className="mt-3 border border-rose-300/25 bg-rose-300/[0.05] px-3 py-2 text-[11px] leading-4 text-rose-100">
          {error}
        </div>
      ) : null}

      {!query.trim() && !isLoading ? (
        <p className="mt-3 border-l border-[#ff4f1f]/60 pl-2 text-[11px] leading-4 text-neutral-400">
          Search Pexels for a visual starting point. Media downloads to this browser only.
        </p>
      ) : null}

      {isLoading && !result ? (
        <div className="mt-3 grid grid-cols-2 gap-2" aria-label="Loading stock footage" aria-busy="true">
          {["one", "two", "three", "four"].map((item) => (
            <div key={item} className="aspect-video animate-pulse bg-white/[0.06]" />
          ))}
        </div>
      ) : null}

      {!isLoading && result && result.videos.length === 0 ? (
        <div className="mt-3 border border-dashed border-white/15 px-3 py-4 text-[11px] leading-4 text-neutral-400">
          No footage matched “{query.trim()}”. Try a broader visual phrase.
        </div>
      ) : null}

      {result && result.videos.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-3">
          {result.videos.map((video) => {
            const canAdd = Boolean(onAdd && video.renditions.length > 0);
            const isAdding = addingId === video.id;
            return (
              <article key={video.id} className="group min-w-0">
                <div
                  role="img"
                  aria-label={`Thumbnail for footage by ${video.photographer}`}
                  className={`relative overflow-hidden bg-neutral-800 bg-cover bg-center ${orientation === "portrait" ? "aspect-[9/16]" : "aspect-video"}`}
                  style={{ backgroundImage: `url(${video.thumbnail})` }}
                >
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-5">
                    <span className="app-data text-[9px] text-neutral-100">{formatDuration(video.duration)}</span>
                    <span className="app-data text-[8px] text-neutral-300">{formatResolution(video)}</span>
                  </div>
                  {onPreview ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onPreview(video)}
                      aria-label={`Preview footage by ${video.photographer}`}
                      className="absolute left-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center border border-white/45 bg-black/45 text-xs text-white opacity-0 outline-none transition group-hover:opacity-100 hover:border-white focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:opacity-40"
                    >
                      ▶
                    </button>
                  ) : null}
                </div>
                <div className="mt-1 flex items-start gap-1">
                  <p className="min-w-0 flex-1 truncate text-[10px] text-neutral-300" title={video.photographer}>
                    {video.photographer}
                  </p>
                  {canAdd ? (
                    <button
                      type="button"
                      disabled={disabled || isAdding}
                      onClick={() => void handleAdd(video)}
                      className="shrink-0 border border-[#ff4f1f]/55 px-1.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#ffb19a] outline-none transition hover:bg-[#ff4f1f]/10 focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:cursor-wait disabled:opacity-50"
                    >
                      {isAdding ? "…" : "Add"}
                    </button>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[9px] text-neutral-500">
                  <a href={video.photographerUrl} target="_blank" rel="noreferrer" className="hover:text-neutral-300">Pexels creator</a>
                </p>
              </article>
            );
          })}
        </div>
      ) : null}

      {result && result.videos.length > 0 ? (
        <p className="mt-4 border-t border-white/10 pt-2 text-[9px] leading-4 text-neutral-500">
          Photos and videos courtesy of <a href={result.attribution.url} target="_blank" rel="noreferrer" className="text-neutral-300 hover:text-neutral-100">Pexels</a>. Credit stays attached to imported source metadata.
        </p>
      ) : null}
    </section>
  );
};

export type { StockVideoPanelProps };
