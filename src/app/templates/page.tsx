import { TEMPLATE_DEFINITIONS } from "@/lib/editor/templates";
import Link from "next/link";
import { readdir } from "node:fs/promises";
import path from "node:path";

const TEMPLATE_PREVIEW_DIR = path.join(process.cwd(), "public", "template-previews");
const BOTTOM_TEMPLATE_IDS = new Set([
  "vox-timeline",
  "vox-timeline-ribbon",
  "vox-timeline-ledger",
] satisfies (typeof TEMPLATE_DEFINITIONS)[number]["id"][]);

const getTemplatePreviewCandidates = (templateId: (typeof TEMPLATE_DEFINITIONS)[number]["id"]) => [
  `widescreen_16_9-${templateId}.mp4`,
  `${templateId}.mp4`,
];

const getTemplateVideoPreviews = async (): Promise<
  Partial<Record<(typeof TEMPLATE_DEFINITIONS)[number]["id"], string>>
> => {
  const entries = await readdir(TEMPLATE_PREVIEW_DIR).catch(() => []);
  const availableFiles = new Set(entries);

  return Object.fromEntries(
    TEMPLATE_DEFINITIONS.map((template) => {
      const matchedFilename = getTemplatePreviewCandidates(template.id).find((candidate) =>
        availableFiles.has(candidate),
      );

      return [
        template.id,
        matchedFilename ? `/template-previews/${matchedFilename}` : undefined,
      ];
    }).filter(([, value]) => typeof value === "string"),
  );
};

export default async function TemplatesPage() {
  const templateVideoPreviews = await getTemplateVideoPreviews();
  const orderedTemplates = [...TEMPLATE_DEFINITIONS].sort((left, right) => {
    const leftBottom = BOTTOM_TEMPLATE_IDS.has(left.id);
    const rightBottom = BOTTOM_TEMPLATE_IDS.has(right.id);

    if (leftBottom === rightBottom) {
      return 0;
    }

    return leftBottom ? 1 : -1;
  });

  return (
    <main className="min-h-screen bg-[#0f0d0a] px-6 py-8 text-neutral-100">
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
              className="inline-flex items-center rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-neutral-950"
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
          {orderedTemplates.map((template) => {
            const previewVideo = templateVideoPreviews[template.id];

            return (
              <article
                key={template.id}
                className="flex h-full flex-col rounded-2xl border border-neutral-700/70 bg-neutral-900/65 p-5"
              >
                {previewVideo ? (
                  <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
                    <div className="aspect-video">
                      <video
                        src={previewVideo}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                ) : null}

                <h2 className={`text-xl font-semibold ${template.accentClass}`}>{template.name}</h2>
                <p className="mt-2 text-sm text-neutral-300">{template.description}</p>

                <div className="mt-auto pt-5">
                  <Link
                    href={`/editor?template=${template.id}`}
                    className="group flex w-full items-center justify-between rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 transition-all duration-150 hover:border-cyan-300/60 hover:bg-cyan-400/20 hover:text-white"
                  >
                    <span>Use Template</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-transform duration-150 group-hover:translate-x-0.5"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
