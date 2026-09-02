import { TEMPLATE_DEFINITIONS } from "@/lib/editor/templates";
import { TemplateMotionPreview } from "@/components/templates/TemplateMotionPreview";
import Link from "next/link";
import { readdir } from "node:fs/promises";
import path from "node:path";

const TEMPLATE_PREVIEW_DIR = path.join(process.cwd(), "public", "template-previews");

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

const getTemplateDiscipline = (templateId: string) => {
  if (templateId.includes("timeline")) return "Chronology";
  if (templateId.includes("map") || templateId.includes("location")) return "Cartography";
  if (
    templateId.includes("chart") ||
    templateId.includes("stat") ||
    templateId.includes("seat")
  ) {
    return "Data story";
  }
  if (templateId.includes("gallery") || templateId.includes("clipping")) return "Archive";
  if (templateId.includes("quote") || templateId.includes("headline")) return "Editorial type";
  return "Title design";
};

const Arrow = ({ className = "" }: { className?: string }) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
    <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeLinecap="square" />
  </svg>
);

export default async function TemplatesPage() {
  const templateVideoPreviews = await getTemplateVideoPreviews();
  const orderedTemplates = [...TEMPLATE_DEFINITIONS];

  return (
    <main className="min-h-screen overflow-hidden bg-[#e9e3d7] text-[#16130f]">
      <nav
        aria-label="Primary navigation"
        className="border-b border-[#16130f]/25 px-4 sm:px-6 lg:px-10"
      >
        <div className="mx-auto flex h-16 w-full max-w-[1480px] items-center justify-between gap-5">
          <Link
            href="/"
            className="group inline-flex min-h-11 items-center gap-3 font-[family-name:var(--font-condensed)] text-xl font-semibold uppercase tracking-[-0.02em] outline-none focus-visible:ring-2 focus-visible:ring-[#e7441b] focus-visible:ring-offset-4 focus-visible:ring-offset-[#e9e3d7]"
          >
            <span className="h-2.5 w-2.5 bg-[#e7441b] transition-transform duration-200 group-hover:rotate-45" />
            Inkframe
          </Link>

          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] sm:gap-5">
            <Link
              href="/"
              className="hidden min-h-11 items-center border-b border-transparent outline-none transition-colors hover:border-[#16130f] focus-visible:ring-2 focus-visible:ring-[#e7441b] sm:inline-flex"
            >
              Home
            </Link>
            <Link
              href="/editor"
              className="inline-flex min-h-11 items-center gap-3 bg-[#16130f] px-4 text-[#f4eee2] outline-none transition-colors hover:bg-[#e7441b] focus-visible:ring-2 focus-visible:ring-[#e7441b] focus-visible:ring-offset-4 focus-visible:ring-offset-[#e9e3d7] sm:px-5"
            >
              Start from scratch
              <Arrow className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      <header className="px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-16 lg:px-10 lg:pb-20 lg:pt-24">
        <div className="mx-auto grid w-full max-w-[1480px] gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-9">
            <p className="mb-5 flex items-center gap-3 font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e7441b] sm:text-xs">
              <span className="h-px w-8 bg-current" />
              Motion template library / 01
            </p>
            <h1 className="max-w-6xl font-[family-name:var(--font-condensed)] text-[clamp(4.1rem,11.5vw,10.5rem)] font-semibold uppercase leading-[0.76] tracking-[-0.055em]">
              Pick the cut.
              <span className="block text-[#e7441b]">Make it yours.</span>
            </h1>
          </div>

          <div className="border-t border-[#16130f]/30 pt-5 lg:col-span-3 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <p className="max-w-sm font-[family-name:var(--font-serif)] text-lg leading-[1.35] sm:text-xl">
              Production-ready motion systems for explainers, documentaries, and sharp visual
              stories.
            </p>
            <dl className="mt-8 grid grid-cols-2 gap-x-5 border-t border-[#16130f]/25 pt-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em]">
              <div>
                <dt className="text-[#6b6257]">Presets</dt>
                <dd className="mt-1 text-base font-medium tracking-normal text-[#16130f]">
                  {String(orderedTemplates.length).padStart(2, "0")}
                </dd>
              </div>
              <div>
                <dt className="text-[#6b6257]">Native builds</dt>
                <dd className="mt-1 text-base font-medium tracking-normal text-[#16130f]">
                  {String(orderedTemplates.length).padStart(2, "0")}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      <section aria-labelledby="template-index-heading" className="px-4 pb-24 sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-[1480px]">
          <div className="flex items-end justify-between gap-6 border-b-2 border-[#16130f] pb-3">
            <h2
              id="template-index-heading"
              className="font-[family-name:var(--font-condensed)] text-2xl font-semibold uppercase tracking-[-0.02em] sm:text-3xl"
            >
              The template index
            </h2>
            <p className="hidden font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#6b6257] md:block">
              Select a row to open in editor
            </p>
          </div>

          {orderedTemplates.length === 0 ? (
            <div className="border-b border-[#16130f]/30 py-20 text-center sm:py-28">
              <p className="font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.16em] text-[#e7441b]">
                No templates yet
              </p>
              <p className="mx-auto mt-4 max-w-md font-[family-name:var(--font-serif)] text-2xl leading-tight sm:text-3xl">
                The library is still being cut. Start with a blank project while we build the
                first collection.
              </p>
            </div>
          ) : (
            <ol>
              {orderedTemplates.map((template, index) => {
                const previewVideo = templateVideoPreviews[template.id];
                const assetCount = template.starterAssets?.length ?? 0;

              return (
                <li key={template.id} className="border-b border-[#16130f]/30">
                  <Link
                    href={`/editor?template=${template.id}`}
                    aria-label={`Use ${template.name} template in the editor`}
                    className="group grid min-h-44 grid-cols-[2.25rem_1fr] gap-x-3 gap-y-5 py-6 outline-none transition-colors duration-200 hover:bg-[#f3ede2] focus-visible:bg-[#f3ede2] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e7441b] sm:grid-cols-[3.5rem_1fr] sm:gap-x-5 sm:py-8 lg:min-h-56 lg:grid-cols-12 lg:items-center lg:gap-6 lg:px-4 lg:py-6"
                  >
                    <span className="self-start pt-1 font-[family-name:var(--font-mono)] text-[10px] font-medium tracking-[0.12em] text-[#8b8175] lg:col-span-1 lg:self-center lg:pt-0">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <div className="col-start-2 row-start-1 lg:col-span-4 lg:col-start-2">
                      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-[family-name:var(--font-mono)] text-[9px] font-medium uppercase tracking-[0.13em] text-[#70675d] sm:text-[10px]">
                        <span className={`h-1.5 w-1.5 bg-current ${template.accentClass}`} />
                        <span>{getTemplateDiscipline(template.id)}</span>
                        <span aria-hidden="true">/</span>
                        <span>16:9</span>
                      </div>
                      <h3 className="font-[family-name:var(--font-condensed)] text-[clamp(2.3rem,5vw,5rem)] font-semibold uppercase leading-[0.86] tracking-[-0.045em] transition-transform duration-300 ease-out group-hover:translate-x-1.5 group-focus-visible:translate-x-1.5">
                        {template.name}
                      </h3>
                    </div>

                    <div className="col-span-2 row-start-2 overflow-hidden bg-[#16130f] sm:col-start-2 sm:col-span-1 lg:col-span-3 lg:col-start-6 lg:row-start-1">
                      <div className="relative aspect-video">
                        {previewVideo ? (
                          <TemplateMotionPreview src={previewVideo} eager={index < 3} />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#211d18_0%,#211d18_49%,#e7441b_50%,#e7441b_51%,#211d18_52%,#211d18_100%)] px-5 text-center font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.16em] text-[#e9e3d7]">
                            Preview in editor
                          </div>
                        )}
                        <span className="absolute left-2 top-2 bg-[#e9e3d7] px-1.5 py-1 font-[family-name:var(--font-mono)] text-[8px] uppercase tracking-[0.1em] text-[#16130f]">
                          {previewVideo ? "Motion preview" : "Live preset"}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2 row-start-3 sm:col-start-2 sm:col-span-1 lg:col-span-3 lg:col-start-9 lg:row-start-1">
                      <p className="max-w-lg text-sm leading-relaxed text-[#554e46] sm:text-base lg:text-sm xl:text-base">
                        {template.description}
                      </p>
                      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 font-[family-name:var(--font-mono)] text-[9px] font-medium uppercase tracking-[0.12em] text-[#766d62]">
                        <span>Editable copy</span>
                        {assetCount > 0 ? (
                          <>
                            <span aria-hidden="true" className="h-0.5 w-0.5 rounded-full bg-current" />
                            <span>
                              {assetCount} starter {assetCount === 1 ? "asset" : "assets"}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="col-span-2 row-start-4 flex min-h-11 items-center justify-between border-t border-[#16130f]/25 pt-3 sm:col-start-2 sm:col-span-1 lg:col-span-1 lg:col-start-12 lg:row-start-1 lg:justify-end lg:border-0 lg:pt-0">
                      <span className="font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#e7441b] lg:sr-only">
                        Use template
                      </span>
                      <span className="grid h-11 w-11 place-items-center border border-[#16130f]/40 bg-transparent text-[#16130f] transition-colors duration-200 group-hover:border-[#e7441b] group-hover:bg-[#e7441b] group-hover:text-[#f4eee2] group-focus-visible:border-[#e7441b] group-focus-visible:bg-[#e7441b] group-focus-visible:text-[#f4eee2]">
                        <Arrow className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
              })}
            </ol>
          )}

          <div className="grid gap-8 border-b border-[#16130f]/30 py-10 sm:grid-cols-2 sm:items-center lg:grid-cols-12">
            <p className="font-[family-name:var(--font-serif)] text-2xl leading-tight sm:text-3xl lg:col-span-7 lg:max-w-2xl">
              Nothing quite fits? Start with an empty timeline and build the visual system your
              story needs.
            </p>
            <Link
              href="/editor"
              className="inline-flex min-h-12 w-full items-center justify-between border border-[#16130f] px-4 font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.14em] outline-none transition-colors hover:bg-[#16130f] hover:text-[#f4eee2] focus-visible:ring-2 focus-visible:ring-[#e7441b] focus-visible:ring-offset-4 focus-visible:ring-offset-[#e9e3d7] sm:justify-self-end lg:col-span-3 lg:col-start-10"
            >
              Open blank project
              <Arrow className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#16130f] px-4 py-6 text-[#a79e92] sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-3 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.14em] sm:flex-row sm:items-center sm:justify-between">
          <p>Inkframe / Browser-based motion composition</p>
          <p>Cut · Type · Export</p>
        </div>
      </footer>
    </main>
  );
}
