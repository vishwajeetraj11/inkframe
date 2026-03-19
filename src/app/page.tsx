import Link from "next/link";

const launchPads = [
  {
    href: "/editor",
    eyebrow: "Timeline-first workflow",
    title: "Media Editor",
    description:
      "Assemble footage, images, audio, and overlays with a traditional edit surface built for short-form exports.",
    cta: "Open Media Editor",
    pill: "clips / audio / export",
    surface:
      "linear-gradient(180deg, rgba(7, 25, 24, 0.92) 0%, rgba(5, 16, 23, 0.96) 100%)",
    glow: "radial-gradient(circle at 12% 12%, rgba(88, 220, 175, 0.22), transparent 44%)",
  },
  {
    href: "/text-motion",
    eyebrow: "Prompt-led motion",
    title: "AI Text Motion",
    description:
      "Start from language, then shape pacing, typography, and scene timing into a finished motion sequence.",
    cta: "Open AI Text Motion",
    pill: "prompt / rhythm / scenes",
    surface:
      "linear-gradient(180deg, rgba(5, 19, 29, 0.92) 0%, rgba(5, 13, 22, 0.96) 100%)",
    glow: "radial-gradient(circle at 16% 18%, rgba(84, 210, 245, 0.24), transparent 46%)",
  },
  {
    href: "/templates",
    eyebrow: "Preset library",
    title: "Browse Templates",
    description:
      "Jump into timelines, charts, maps, and editorial openers without rebuilding the visual system each time.",
    cta: "Browse Templates",
    pill: "timelines / maps / charts",
    surface:
      "linear-gradient(180deg, rgba(28, 20, 8, 0.9) 0%, rgba(15, 13, 18, 0.96) 100%)",
    glow: "radial-gradient(circle at 16% 18%, rgba(241, 199, 108, 0.2), transparent 46%)",
  },
] as const;

const studioSignals = [
  { value: "3", label: "creation modes" },
  { value: "2", label: "export aspects" },
  { value: "1", label: "shared studio" },
] as const;

const templateShelf = [
  "Vox timelines",
  "Seat arcs",
  "Stat rings",
  "World maps",
  "Dictionary motion",
  "Chart cards",
] as const;

function MediaEditorPreview() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-white/50">
        <span className="app-eyebrow">Sequence View</span>
        <span className="app-data text-[10px]">00:27</span>
      </div>

      <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-[rgba(6,18,32,0.8)] p-4">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="absolute left-[39%] top-3 bottom-3 w-px bg-cyan-300/50" />

        <div className="space-y-3">
          <div className="h-4 w-[84%] rounded-full bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300/60" />
          <div className="h-3 w-[58%] rounded-full bg-white/16" />

          <div className="grid grid-cols-[1.2fr_0.9fr_0.65fr] gap-2">
            <div className="h-9 rounded-2xl border border-emerald-200/15 bg-emerald-300/12" />
            <div className="h-9 rounded-2xl border border-cyan-200/15 bg-cyan-300/10" />
            <div className="h-9 rounded-2xl border border-white/10 bg-white/[0.08]" />
          </div>

          <div className="flex items-center gap-2">
            {Array.from({ length: 18 }).map((_, index) => (
              <span
                // eslint-disable-next-line react/no-array-index-key
                key={`wave-${index}`}
                className="block w-1 rounded-full bg-cyan-200/55"
                style={{ height: `${10 + (index % 5) * 6}px` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TextMotionPreview() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-white/50">
        <span className="app-eyebrow">Prompt Stack</span>
        <span className="app-data text-[10px]">Beat-synced</span>
      </div>

      <div className="rounded-[20px] border border-white/10 bg-[rgba(5,17,29,0.82)] p-4">
        <div className="flex items-center justify-between text-[11px] text-cyan-100/70">
          <span>Prompt</span>
          <span className="rounded-full border border-cyan-200/15 px-2 py-1 text-[10px] uppercase tracking-[0.18em]">
            ai
          </span>
        </div>

        <div className="mt-4 space-y-1">
          <p className="app-title text-3xl font-semibold leading-none tracking-[-0.07em] text-white">
            BUILD
          </p>
          <p className="app-title text-3xl font-semibold leading-none tracking-[-0.07em] text-cyan-200">
            THE
          </p>
          <p className="app-title text-3xl font-semibold leading-none tracking-[-0.07em] text-white/45">
            PAYOFF
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          {["hook", "setup", "payoff"].map((beat) => (
            <span
              key={beat}
              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70"
            >
              {beat}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplatePreview() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-white/50">
        <span className="app-eyebrow">Editorial Starts</span>
        <span className="app-data text-[10px]">Preset shelf</span>
      </div>

      <div className="rounded-[20px] border border-white/10 bg-[rgba(21,17,12,0.78)] p-4">
        <div className="grid grid-cols-3 gap-2">
          {["timeline", "map", "chart"].map((item, index) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 px-3 py-4"
              style={{
                background:
                  index === 0
                    ? "linear-gradient(180deg, rgba(105, 180, 255, 0.12), rgba(255,255,255,0.02))"
                    : index === 1
                      ? "linear-gradient(180deg, rgba(97, 226, 187, 0.12), rgba(255,255,255,0.02))"
                      : "linear-gradient(180deg, rgba(241, 199, 108, 0.12), rgba(255,255,255,0.02))",
              }}
            >
              <div className="app-eyebrow text-[10px] text-white/55">{item}</div>
              <div className="mt-3 h-7 rounded-full bg-white/[0.08]" />
              <div className="mt-2 h-2 w-2/3 rounded-full bg-white/15" />
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-[1.15fr_0.85fr] gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
            <div className="h-2 w-20 rounded-full bg-white/15" />
            <div className="mt-3 flex items-end gap-1">
              {[18, 30, 22, 34, 26].map((height, index) => (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={`bar-${index}`}
                  className="block flex-1 rounded-t-full bg-amber-200/55"
                  style={{ height }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
            <div className="h-full rounded-[14px] border border-dashed border-white/12 bg-[radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.12),transparent_56%)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function LaunchPreview({ href }: { href: (typeof launchPads)[number]["href"] }) {
  if (href === "/editor") {
    return <MediaEditorPreview />;
  }

  if (href === "/text-motion") {
    return <TextMotionPreview />;
  }

  return <TemplatePreview />;
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111f] text-white">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 12% 14%, rgba(83, 120, 182, 0.28), transparent 28%)," +
            "radial-gradient(circle at 84% 12%, rgba(31, 106, 156, 0.24), transparent 26%)," +
            "radial-gradient(circle at 50% 82%, rgba(244, 194, 101, 0.08), transparent 30%)," +
            "linear-gradient(180deg, #0c1527 0%, #07111f 52%, #050b16 100%)",
        }}
      />

      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.35) 70%, transparent)",
        }}
      />

      <div
        className="pointer-events-none absolute -left-12 top-[4.5rem] h-52 w-52 rounded-full blur-3xl"
        style={{
          background: "rgba(101, 229, 186, 0.12)",
          animation: "landing-drift 14s ease-in-out infinite",
        }}
      />
      <div
        className="pointer-events-none absolute right-0 top-20 h-64 w-64 rounded-full blur-3xl"
        style={{
          background: "rgba(85, 208, 245, 0.14)",
          animation: "landing-pulse 12s ease-in-out infinite",
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-10">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_410px] xl:grid-cols-[minmax(0,1.18fr)_430px]">
          <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[rgba(7,12,22,0.72)] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-8 lg:p-10">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(140deg, rgba(255,255,255,0.07), rgba(255,255,255,0) 28%)," +
                  "linear-gradient(180deg, rgba(8,14,24,0.1), rgba(8,14,24,0.58) 88%)",
              }}
            />
            <div
              className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full blur-3xl"
              style={{
                background: "rgba(241, 199, 108, 0.14)",
                animation: "landing-float 10s ease-in-out infinite",
              }}
            />

            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <span className="app-eyebrow rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-cyan-200">
                  Ephemeral Studio
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                  Next.js + Remotion
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                  9:16 + 16:9
                </span>
              </div>

              <p className="app-eyebrow mt-12 text-sm uppercase tracking-[0.24em] text-cyan-200 sm:text-base">
                Build motion systems, not one-off exports
              </p>

              <h1 className="app-title mt-4 max-w-4xl text-[clamp(3.5rem,8vw,6.5rem)] font-semibold leading-[0.9] tracking-[-0.08em] text-white">
                Motion studio for
                <span
                  className="mt-2 block text-[0.78em] font-semibold italic tracking-[-0.04em] text-[#f2d28e]"
                  style={{
                    fontFamily:
                      'var(--font-cormorant-garamond), "Cormorant Garamond", Georgia, serif',
                  }}
                >
                  editorial video, text motion, and fast template starts.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Cut footage, prompt typography, and move from template to export in one product.
                The landing page now frames the studio around the three actual ways people start.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/editor"
                  className="inline-flex items-center rounded-full bg-[linear-gradient(135deg,#61e2bb,#44c7f3)] px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(68,199,243,0.24)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(68,199,243,0.3)]"
                >
                  Open Media Editor
                </Link>

                <Link
                  href="/text-motion"
                  className="inline-flex items-center rounded-full border border-cyan-200/20 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-300/16"
                >
                  Open AI Text Motion
                </Link>

                <Link
                  href="/templates"
                  className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.08]"
                >
                  Browse Templates
                </Link>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {studioSignals.map((signal) => (
                  <div
                    key={signal.label}
                    className="rounded-[24px] border border-white/10 bg-white/[0.045] px-4 py-4 backdrop-blur-sm"
                  >
                    <p className="app-title text-3xl font-semibold tracking-[-0.07em] text-white">
                      {signal.value}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">{signal.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[rgba(7,12,22,0.72)] p-5 shadow-[0_22px_80px_rgba(0,0,0,0.32)] backdrop-blur-md">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 22%)," +
                    "radial-gradient(circle at 70% 0%, rgba(86,210,245,0.12), transparent 34%)",
                }}
              />

              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="app-eyebrow text-[11px] uppercase tracking-[0.22em] text-cyan-200">
                      Studio Preview
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      The product split is visible immediately.
                    </p>
                  </div>

                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                    live modes
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  <div
                    className="rounded-[24px] border border-emerald-200/10 bg-[rgba(7,22,28,0.84)] p-4"
                    style={{ animation: "landing-float 11s ease-in-out infinite" }}
                  >
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/50">
                      <span>Media edit</span>
                      <span className="app-data">01</span>
                    </div>
                    <div className="mt-3 h-2 w-24 rounded-full bg-emerald-300/70" />
                    <div className="mt-2 grid grid-cols-[1.15fr_0.9fr_0.7fr] gap-2">
                      <div className="h-8 rounded-2xl bg-emerald-300/14" />
                      <div className="h-8 rounded-2xl bg-cyan-300/12" />
                      <div className="h-8 rounded-2xl bg-white/8" />
                    </div>
                  </div>

                  <div
                    className="rounded-[24px] border border-cyan-200/10 bg-[rgba(7,19,29,0.84)] p-4"
                    style={{ animation: "landing-float 13s ease-in-out infinite" }}
                  >
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/50">
                      <span>Text motion</span>
                      <span className="app-data">02</span>
                    </div>
                    <p className="app-title mt-3 text-2xl font-semibold tracking-[-0.07em] text-white">
                      Hook
                    </p>
                    <p className="app-title text-2xl font-semibold tracking-[-0.07em] text-cyan-200">
                      Build
                    </p>
                    <p className="app-title text-2xl font-semibold tracking-[-0.07em] text-white/40">
                      Payoff
                    </p>
                  </div>

                  <div
                    className="rounded-[24px] border border-amber-200/10 bg-[rgba(23,18,13,0.84)] p-4"
                    style={{ animation: "landing-float 12s ease-in-out infinite" }}
                  >
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/50">
                      <span>Template shelf</span>
                      <span className="app-data">03</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["timeline", "map", "chart", "seat arc"].map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-[rgba(7,12,22,0.72)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-md">
              <p className="app-eyebrow text-[11px] uppercase tracking-[0.22em] text-amber-200">
                Template Shelf
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Editorial presets stay visible on the home screen instead of hiding behind a generic
                studio title.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {templateShelf.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/70"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {launchPads.map((pad) => (
            <Link
              key={pad.href}
              href={pad.href}
              className="group relative overflow-hidden rounded-[30px] border border-white/10 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.28)] transition duration-200 hover:-translate-y-1 hover:border-white/16"
              style={{
                background: `${pad.glow}, ${pad.surface}`,
              }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <span className="app-eyebrow text-[11px] uppercase tracking-[0.22em] text-white/60">
                    {pad.eyebrow}
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                    {pad.pill}
                  </span>
                </div>

                <h2 className="app-title mt-5 text-4xl font-semibold tracking-[-0.06em] text-white">
                  {pad.title}
                </h2>

                <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">
                  {pad.description}
                </p>

                <div className="mt-5">
                  <LaunchPreview href={pad.href} />
                </div>

                <div className="mt-6 flex items-center justify-between text-sm font-semibold text-white">
                  <span>{pad.cta}</span>
                  <span className="transition duration-200 group-hover:translate-x-1">-&gt;</span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
