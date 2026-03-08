import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_20%,_#334155,_#020617_65%)] p-6 text-white">
      <div className="w-full max-w-3xl rounded-3xl border border-neutral-700/70 bg-neutral-900/70 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <p className="app-eyebrow mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Next.js + Remotion
        </p>
        <h1 className="app-title text-4xl font-semibold leading-tight md:text-5xl">
          Motion Video Studio
        </h1>
        <p className="mt-3 text-neutral-300">
          Build in two modes: classic media editor or AI text motion editor,
          both with 9:16 and 16:9 exports.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/editor"
            className="inline-flex items-center rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-neutral-950"
          >
            Open Media Editor
          </Link>

          <Link
            href="/text-motion"
            className="inline-flex items-center rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-neutral-950"
          >
            Open AI Text Motion
          </Link>

          <Link
            href="/templates"
            className="inline-flex items-center rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-100"
          >
            Browse Templates
          </Link>
        </div>
      </div>
    </main>
  );
}
