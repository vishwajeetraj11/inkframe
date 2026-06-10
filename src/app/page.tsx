"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const INK = "#0F0D0A";
const BONE = "#F2EDE3";
const VERMILLION = "#FF4F1F";

const SERIF_STACK = 'var(--font-cormorant-garamond), "Cormorant Garamond", Georgia, serif';

const EXPO_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

const CYCLE_WORDS = ["FRAME.", "CUT.", "BEAT.", "EXPORT."] as const;

const PRESETS = [
  "vox-timeline",
  "world-map-focus",
  "editorial-stat-ring",
  "news-clipping",
  "editorial-seat-arc",
  "film-frame-gallery",
  "chart-card",
  "createdaley-opener",
  "editorial-bar-chart",
  "regional-map-focus",
  "vox-timeline-ribbon",
  "vox-timeline-ledger",
] as const;

const MODES = [
  {
    index: "01",
    href: "/editor",
    title: "MEDIA EDITOR",
    navLabel: "Editor",
    reveal: "cut the footage",
    description:
      "Timeline editing for clips, audio, and structured overlays. Scrub, trim, layer — then export MP4.",
    meta: "clips · audio · overlays",
  },
  {
    index: "02",
    href: "/text-motion",
    title: "AI TEXT MOTION",
    navLabel: "Text Motion",
    reveal: "prompt the type",
    description:
      "Describe a storyboard, get beat-synced kinetic typography. Tune pacing scene by scene.",
    meta: "prompt · scenes · rhythm",
  },
  {
    index: "03",
    href: "/templates",
    title: "TEMPLATE LIBRARY",
    navLabel: "Templates",
    reveal: "steal the start",
    description:
      "Editorial presets — annotated timelines, maps, stat rings — preloaded straight into the editor.",
    meta: "12 presets · one click",
  },
] as const;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Timecode() {
  const [frames, setFrames] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      setFrames(Math.floor(((now - start) / 1000) * 30));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const ff = String(frames % 30).padStart(2, "0");
  const totalSeconds = Math.floor(frames / 30);
  const ss = String(totalSeconds % 60).padStart(2, "0");
  const mm = String(Math.floor(totalSeconds / 60) % 60).padStart(2, "0");

  return (
    <span className="app-data text-xs" style={{ color: `${BONE}99` }}>
      00:{mm}:{ss}:
      <span style={{ color: VERMILLION }}>{ff}</span>
    </span>
  );
}

function CyclingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }

    const id = setInterval(() => {
      setIndex((current) => (current + 1) % CYCLE_WORDS.length);
    }, 2200);

    return () => clearInterval(id);
  }, []);

  return (
    <span className="inline-flex items-baseline" style={{ color: VERMILLION }}>
      <span
        key={CYCLE_WORDS[index]}
        className="inline-block"
        style={{ animation: `kinetic-cut 0.45s ${EXPO_OUT} both` }}
      >
        {CYCLE_WORDS[index]}
      </span>
      <span
        aria-hidden
        className="ml-[0.08em] inline-block h-[0.72em] w-[0.34em] self-center"
        style={{
          background: VERMILLION,
          animation: "kinetic-blink 1.1s steps(1) infinite",
        }}
      />
    </span>
  );
}

function HeroLine({
  children,
  delay,
  className,
  style,
}: {
  children: React.ReactNode;
  delay: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className="overflow-hidden">
      <div
        className={className}
        style={{
          animation: `kinetic-rise 0.9s ${EXPO_OUT} ${delay}s both`,
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function FrameRuler() {
  return (
    <div
      aria-hidden
      className="relative h-7 overflow-hidden"
      style={{
        backgroundImage:
          `repeating-linear-gradient(90deg, ${BONE}38 0 1px, transparent 1px 10px),` +
          `repeating-linear-gradient(90deg, ${BONE}59 0 1px, transparent 1px 100px)`,
        backgroundPosition: "bottom",
        backgroundSize: "100% 10px, 100% 100%",
        backgroundRepeat: "repeat-x, repeat-x",
        maskImage: "linear-gradient(90deg, transparent, black 6%, black 94%, transparent)",
      }}
    >
      <span
        className="absolute top-0 h-full w-[2px]"
        style={{
          background: VERMILLION,
          animation: "kinetic-playhead 24s linear infinite",
        }}
      />
    </div>
  );
}

function PresetMarquee() {
  return (
    <div
      className="overflow-hidden border-y py-4"
      style={{ borderColor: `${BONE}1f` }}
    >
      <div
        className="flex w-max"
        style={{ animation: "kinetic-marquee 36s linear infinite" }}
      >
        {[0, 1].map((copy) => (
          <div
            key={`marquee-${copy}`}
            aria-hidden={copy === 1}
            className="flex shrink-0 items-center"
          >
            {PRESETS.map((preset) => (
              <span key={preset} className="flex items-center">
                <span
                  className="app-data px-6 text-sm uppercase"
                  style={{ color: `${BONE}8c` }}
                >
                  {preset}
                </span>
                <span
                  className="block h-1.5 w-1.5 rotate-45"
                  style={{ background: VERMILLION }}
                />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ModeRow({ mode, delay }: { mode: (typeof MODES)[number]; delay: number }) {
  return (
    <Link
      href={mode.href}
      className="group block border-t outline-none"
      style={{
        borderColor: `${BONE}24`,
        animation: `kinetic-fade-up 0.8s ${EXPO_OUT} ${delay}s both`,
      }}
    >
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-5 py-7 transition-colors duration-300 group-focus-visible:bg-[rgba(242,237,227,0.05)] sm:grid-cols-[3.5rem_1fr_minmax(0,17rem)_3rem] sm:gap-x-8 sm:py-9">
        <span className="app-data text-sm" style={{ color: `${BONE}66` }}>
          {mode.index}
        </span>

        <span className="relative block overflow-hidden">
          <span
            className="font-condensed block text-[clamp(2.4rem,6.5vw,5rem)] font-semibold uppercase leading-[0.95] tracking-[0.01em] transition-transform duration-500 group-hover:-translate-y-full"
            style={{ color: BONE, transitionTimingFunction: EXPO_OUT }}
          >
            {mode.title}
          </span>
          <span
            aria-hidden
            className="absolute inset-0 flex translate-y-full items-center text-[clamp(1.9rem,5vw,3.8rem)] italic leading-none transition-transform duration-500 group-hover:translate-y-0"
            style={{
              color: VERMILLION,
              fontFamily: SERIF_STACK,
              transitionTimingFunction: EXPO_OUT,
            }}
          >
            {mode.reveal}
          </span>
        </span>

        <span className="col-start-2 mt-3 sm:col-start-3 sm:mt-0">
          <span className="block text-sm leading-6" style={{ color: `${BONE}a6` }}>
            {mode.description}
          </span>
          <span
            className="app-data mt-2 block text-[11px] uppercase"
            style={{ color: `${BONE}59` }}
          >
            {mode.meta}
          </span>
        </span>

        <span
          className="hidden text-3xl transition-transform duration-500 group-hover:translate-x-2 sm:block"
          style={{ color: VERMILLION, transitionTimingFunction: EXPO_OUT }}
        >
          →
        </span>
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <main
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{ background: INK, color: BONE }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 sm:px-8">
        <header
          className="flex items-center justify-between border-b py-5"
          style={{ borderColor: `${BONE}1f` }}
        >
          <span className="flex items-center gap-3">
            <span
              className="block h-2.5 w-2.5"
              style={{
                background: VERMILLION,
                animation: "kinetic-blink 2.4s steps(1) infinite",
              }}
            />
            <span className="font-condensed text-base font-semibold uppercase tracking-[0.32em]">
              Inkframe
            </span>
          </span>

          <span className="flex items-center gap-5 sm:gap-7">
            <nav aria-label="Primary" className="flex items-center gap-4 sm:gap-6">
              {MODES.map((mode) => (
                <Link
                  key={mode.href}
                  href={mode.href}
                  className="font-condensed text-xs font-medium uppercase tracking-[0.22em] transition-colors duration-200 hover:text-[#FF4F1F] focus-visible:text-[#FF4F1F]"
                  style={{ color: `${BONE}b3` }}
                >
                  {mode.navLabel}
                </Link>
              ))}
            </nav>
            <span className="hidden items-center gap-3 sm:flex">
              <span className="app-data text-[11px] uppercase" style={{ color: `${BONE}59` }}>
                rec
              </span>
              <Timecode />
            </span>
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16 sm:py-20">
          <p
            className="font-condensed text-sm font-medium uppercase tracking-[0.34em]"
            style={{
              color: `${BONE}80`,
              animation: `kinetic-fade-up 0.8s ${EXPO_OUT} 0.05s both`,
            }}
          >
            A motion studio in the browser
          </p>

          <h1 className="font-condensed mt-6 text-[clamp(4rem,13vw,10.5rem)] font-bold uppercase leading-[0.86]">
            <HeroLine delay={0.1}>Every word</HeroLine>
            <HeroLine
              delay={0.22}
              style={{ WebkitTextStroke: `1.5px ${BONE}`, color: "transparent" }}
            >
              earns its
            </HeroLine>
            <HeroLine delay={0.34}>
              <CyclingWord />
            </HeroLine>
          </h1>

          <p
            className="mt-10 max-w-xl text-base leading-7 sm:text-lg"
            style={{
              color: `${BONE}a6`,
              animation: `kinetic-fade-up 0.8s ${EXPO_OUT} 0.5s both`,
            }}
          >
            Cut footage on a timeline, prompt kinetic typography, or start from an
            editorial preset — then export MP4 in{" "}
            <span className="app-data" style={{ color: BONE }}>
              9:16
            </span>{" "}
            or{" "}
            <span className="app-data" style={{ color: BONE }}>
              16:9
            </span>
            .
          </p>

          <div
            className="mt-10 flex flex-wrap items-center gap-4"
            style={{ animation: `kinetic-fade-up 0.8s ${EXPO_OUT} 0.55s both` }}
          >
            <Link
              href="/templates"
              className="font-condensed group inline-flex items-center gap-3 px-6 py-3.5 text-base font-semibold uppercase tracking-[0.18em] transition-transform duration-300 hover:-translate-y-0.5"
              style={{ background: VERMILLION, color: INK }}
            >
              Browse templates
              <span
                className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden
              >
                →
              </span>
            </Link>

            <Link
              href="/editor"
              className="font-condensed inline-flex items-center gap-3 border px-6 py-3.5 text-base font-semibold uppercase tracking-[0.18em] transition-colors duration-300 hover:border-[#FF4F1F] hover:text-[#FF4F1F]"
              style={{ borderColor: `${BONE}45`, color: BONE }}
            >
              Open editor
            </Link>
          </div>

          <div
            className="mt-12"
            style={{ animation: `kinetic-fade-up 0.8s ${EXPO_OUT} 0.65s both` }}
          >
            <FrameRuler />
          </div>
        </section>

        <nav aria-label="Studio modes" className="pb-4">
          {MODES.map((mode, index) => (
            <ModeRow key={mode.href} mode={mode} delay={0.65 + index * 0.08} />
          ))}
        </nav>
      </div>

      <div
        className="relative"
        style={{ animation: `kinetic-fade-up 0.8s ${EXPO_OUT} 0.9s both` }}
      >
        <PresetMarquee />

        <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <span className="app-data text-[11px] uppercase" style={{ color: `${BONE}59` }}>
            fps 30 / max 60s / 1800 frames
          </span>
          <span className="app-data text-[11px] uppercase" style={{ color: `${BONE}59` }}>
            next.js + remotion
          </span>
        </footer>
      </div>
    </main>
  );
}
