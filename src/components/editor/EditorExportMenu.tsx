"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  FileCode2,
  Film,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

export type TimelineExportFormat = "fcpxml" | "edl" | "fcpxml-bundle";

export interface TimelineExportPreflight {
  transferred: string[];
  simplifiedOrOmitted: string[];
  errors: string[];
}

interface EditorExportMenuProps {
  canExportMp4: boolean;
  canExportTimeline: boolean;
  isExporting: boolean;
  timelinePreflight: Record<TimelineExportFormat, TimelineExportPreflight>;
  onExportMp4: () => void;
  onExportTimeline: (format: TimelineExportFormat) => void;
}

const TIMELINE_EXPORTS = [
  {
    format: "fcpxml",
    label: "FCPXML",
    detail: "Final Cut Pro timeline",
  },
  {
    format: "edl",
    label: "EDL",
    detail: "CMX 3600 edit list",
  },
  {
    format: "fcpxml-bundle",
    label: "FCPXML + media",
    detail: "ZIP with timeline and sources",
  },
] as const;

const PERMANENT_LIMITATIONS: Record<TimelineExportFormat, string[]> = {
  fcpxml: [
    "Typewriter and word-reveal titles change text over time and must be rebuilt in Final Cut.",
    "Slide/wipe transitions, retimed transitions, and dissolves without verified media handles remain timing markers.",
    "Inkframe color looks are not embedded in plain FCPXML; reproduce them manually or use the media bundle's LUTs.",
    "Remote provider links can expire; use FCPXML + media for a durable handoff.",
  ],
  edl: [
    "CMX 3600 is a cut-list format and cannot preserve the complete Inkframe composition.",
  ],
  "fcpxml-bundle": [
    "Typewriter and word-reveal titles change text over time and must be rebuilt in Final Cut.",
    "Slide/wipe transitions, retimed transitions, and dissolves without verified media handles remain timing markers.",
    "Included .cube color looks are approximations and must be applied to their matching clip IDs manually.",
  ],
};

export const EditorExportMenu = ({
  canExportMp4,
  canExportTimeline,
  isExporting,
  timelinePreflight,
  onExportMp4,
  onExportTimeline,
}: EditorExportMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<TimelineExportFormat | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mp4IsDisabled = isExporting || !canExportMp4;
  const menuIsDisabled = isExporting || (!canExportMp4 && !canExportTimeline);
  const menuIsOpen = isOpen && !menuIsDisabled;

  useEffect(() => {
    if (!menuIsOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedFormat(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSelectedFormat(null);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuIsOpen]);

  const runExport = (action: () => void) => {
    setIsOpen(false);
    setSelectedFormat(null);
    action();
  };

  const selectedOption = TIMELINE_EXPORTS.find(
    (option) => option.format === selectedFormat,
  );
  const selectedPreflight = selectedFormat
    ? timelinePreflight[selectedFormat]
    : null;

  return (
    <div ref={containerRef} className="relative flex shrink-0">
      <button
        type="button"
        disabled={mp4IsDisabled}
        onClick={() => runExport(onExportMp4)}
        aria-label={isExporting ? "Rendering MP4" : "Export MP4"}
        title={isExporting ? "Rendering MP4" : "Export MP4"}
        className="group relative inline-flex h-[44px] items-center justify-center gap-2 bg-cyan-300 px-3 text-neutral-950 outline-none transition hover:bg-cyan-200 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0d0a] disabled:cursor-not-allowed disabled:opacity-45 xl:h-10"
      >
        {isExporting ? (
          <LoaderCircle aria-hidden="true" size={17} className="animate-spin" />
        ) : (
          <Download aria-hidden="true" size={17} strokeWidth={1.8} />
        )}
        <span className="hidden text-[10px] font-semibold tracking-[0.04em] 2xl:inline">
          {isExporting ? "Rendering" : "MP4"}
        </span>
      </button>

      <button
        type="button"
        disabled={menuIsDisabled}
        onClick={() => {
          setSelectedFormat(null);
          setIsOpen((current) => !current);
        }}
        aria-label="Choose export format"
        aria-haspopup="menu"
        aria-expanded={menuIsOpen}
        className="inline-flex h-[44px] w-8 items-center justify-center border-l border-neutral-950/20 bg-cyan-300 text-neutral-950 outline-none transition hover:bg-cyan-200 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0d0a] disabled:cursor-not-allowed disabled:opacity-45 xl:h-10"
      >
        <ChevronDown
          aria-hidden="true"
          size={14}
          className={`transition-transform ${menuIsOpen ? "rotate-180" : ""}`}
        />
      </button>

      {menuIsOpen ? (
        <div
          role="menu"
          aria-label="Export formats"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(24rem,calc(100vw-1rem))] border border-white/15 bg-[#17140f] text-[#f2ede3] shadow-2xl shadow-black/40"
        >
          <div className="border-b border-white/10 px-3 py-2.5">
            <p className="app-eyebrow text-[9px] text-neutral-500">Deliverable</p>
            <p className="app-title mt-0.5 text-xs font-semibold">Export active timeline</p>
          </div>

          <button
            type="button"
            role="menuitem"
            disabled={!canExportMp4}
            onClick={() => runExport(onExportMp4)}
            className="grid w-full grid-cols-[28px_1fr_auto] items-center gap-2 border-b border-white/10 px-3 py-2.5 text-left outline-none transition hover:bg-white/[0.04] focus-visible:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Film aria-hidden="true" size={16} className="text-cyan-300" />
            <span>
              <span className="block text-[11px] font-semibold">MP4</span>
              <span className="block text-[9px] text-neutral-500">Rendered video</span>
            </span>
            <span className="app-data text-[8px] text-neutral-600">MEDIA</span>
          </button>

          {TIMELINE_EXPORTS.map(({ format, label, detail }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              aria-label={`${label}: ${detail}`}
              disabled={!canExportTimeline}
              onClick={() => setSelectedFormat(format)}
              className="grid w-full grid-cols-[28px_1fr_auto] items-center gap-2 border-b border-white/10 px-3 py-2.5 text-left outline-none transition last:border-b-0 hover:bg-white/[0.04] focus-visible:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FileCode2 aria-hidden="true" size={16} className="text-[#ff4f1f]" />
              <span>
                <span className="block text-[11px] font-semibold">{label}</span>
                <span className="block text-[9px] text-neutral-500">{detail}</span>
              </span>
              <span className="app-data text-[8px] text-neutral-600">EDITABLE</span>
            </button>
          ))}

          {selectedFormat && selectedOption && selectedPreflight ? (
            <section
              aria-label={`${selectedOption.label} compatibility report`}
              className="border-t border-white/15 bg-[#11100d]"
            >
              <div className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2.5">
                <div>
                  <p className="app-eyebrow text-[8px] text-emerald-300">Timeline structure transferred</p>
                  <ul className="mt-1 space-y-0.5 text-[9px] leading-4 text-neutral-300">
                    {selectedPreflight.transferred.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <span className="app-data text-[8px] text-neutral-600">{selectedOption.label}</span>
              </div>

              {selectedPreflight.simplifiedOrOmitted.length > 0 ? (
                <div role="status" className="flex gap-2 border-t border-amber-300/20 bg-amber-300/[0.06] px-3 py-2.5">
                  <TriangleAlert aria-hidden="true" size={14} className="mt-px shrink-0 text-amber-300" />
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold text-amber-200">Approximate or manually reconstruct</p>
                    <ul className="mt-0.5 max-h-24 space-y-1 overflow-y-auto text-[9px] leading-4 text-amber-100/70">
                      {selectedPreflight.simplifiedOrOmitted.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              <div
                aria-label="Known export limitations"
                className="border-t border-white/10 px-3 py-2.5 text-[9px] leading-4 text-neutral-400"
              >
                <p className="font-semibold text-neutral-200">
                  MP4 is the pixel-accurate visual reference.
                </p>
                <ul className="mt-1 space-y-0.5">
                  {PERMANENT_LIMITATIONS[selectedFormat].map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              </div>

              {selectedPreflight.errors.length > 0 ? (
                <div role="alert" className="border-t border-red-300/20 bg-red-300/[0.06] px-3 py-2 text-[9px] leading-4 text-red-200">
                  {selectedPreflight.errors[0]}
                </div>
              ) : null}

              <div className="border-t border-white/10 p-2">
                <button
                  type="button"
                  disabled={selectedPreflight.errors.length > 0}
                  onClick={() => runExport(() => onExportTimeline(selectedFormat))}
                  className="inline-flex min-h-9 w-full items-center justify-center gap-2 bg-[#ff4f1f] px-3 text-[10px] font-semibold text-[#160b07] outline-none transition hover:bg-[#ff6a40] focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download aria-hidden="true" size={14} />
                  I understand — Download {selectedOption.label}
                </button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
