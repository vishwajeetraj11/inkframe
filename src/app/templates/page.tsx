import { TEMPLATE_DEFINITIONS } from "@/lib/editor/templates";
import { TEXT_OVERLAY_STYLE_PRESET_LABELS } from "@/lib/editor/types";
import Link from "next/link";

export default function TemplatesPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,_#334155,_#020617_65%)] px-6 py-8 text-neutral-100">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-6 rounded-2xl border border-neutral-700/70 bg-neutral-900/65 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Template Library
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            All Video Text Templates
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-300">
            Browse starter templates across the available overlay styles and open the editor with
            any template preloaded.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/editor"
              className="inline-flex items-center rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-neutral-950"
            >
              Open Editor
            </Link>
            <Link
              href="/"
              className="inline-flex items-center rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-100"
            >
              Back Home
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {TEMPLATE_DEFINITIONS.map((template) => (
            <article
              key={template.id}
              className="flex h-full flex-col rounded-2xl border border-neutral-700/70 bg-neutral-900/65 p-5"
            >
              <p
                className={`text-xs font-semibold uppercase tracking-[0.16em] ${template.accentClass}`}
              >
                {TEXT_OVERLAY_STYLE_PRESET_LABELS[template.stylePreset]}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">{template.name}</h2>
              <p className="mt-2 text-sm text-neutral-300">{template.description}</p>

              <pre className="mt-4 flex-1 rounded-lg border border-neutral-700 bg-neutral-950/70 p-3 text-xs leading-relaxed text-neutral-200 whitespace-pre-wrap">
                {template.sampleText}
              </pre>

              <Link
                href={`/editor?template=${template.id}`}
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-neutral-950"
              >
                Use Template
              </Link>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
