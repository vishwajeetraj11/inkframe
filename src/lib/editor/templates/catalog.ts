import type { TextOverlayStylePreset } from "../types";

export interface TemplateDefinition {
  id: string;
  stylePreset: TextOverlayStylePreset;
  name: string;
  description: string;
  sampleText: string;
  accentClass: string;
}

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: "classic",
    stylePreset: "classic",
    name: "Classic",
    description: "Clean cinematic captions with smooth word-by-word reveal.",
    sampleText: "A clear story\nstarts with context",
    accentClass: "text-cyan-300",
  },
  {
    id: "impact-grid",
    stylePreset: "impact-grid",
    name: "Impact Grid",
    description: "Punchy all-caps grid for high-energy short-form cuts.",
    sampleText: "Move fast\nbreak the scroll",
    accentClass: "text-fuchsia-300",
  },
  {
    id: "grid-kinetic",
    stylePreset: "grid-kinetic",
    name: "Grid Kinetic",
    description: "Dark grid field with stacked setup lines and one oversized neon payoff word.",
    sampleText: "animating text\nlike this\ncan be\nchallenging",
    accentClass: "text-emerald-300",
  },
  {
    id: "hero-slam",
    stylePreset: "hero-slam",
    name: "Hero Slam",
    description: "One dominant hero word with supporting lines around it.",
    sampleText: "Your biggest idea\nowns the screen",
    accentClass: "text-rose-300",
  },
  {
    id: "sticker-cutout",
    stylePreset: "sticker-cutout",
    name: "Sticker Cutout",
    description: "Layered sticker-like labels that pop in sequence.",
    sampleText: "Cut through noise\nwith bold words",
    accentClass: "text-amber-300",
  },
  {
    id: "editorial-mono",
    stylePreset: "editorial-mono",
    name: "Editorial Mono",
    description: "Structured editorial blocks for analysis-heavy scripts.",
    sampleText: "Data-driven stories\nwin attention",
    accentClass: "text-emerald-300",
  },
  {
    id: "vox-explainer",
    stylePreset: "vox-explainer",
    name: "Vox Explainer",
    description: "Signature explainer card with kicker, headline, and stat payoff.",
    sampleText:
      "EXPLAINED\nWhy cities keep getting hotter\nMaps, asphalt, and policy choices\n+7 degrees in dense neighborhoods",
    accentClass: "text-yellow-300",
  },
  {
    id: "vox-typography",
    stylePreset: "vox-typography",
    name: "Vox Typography",
    description: "Dark editorial typography opener with yellow badge, serif hero word, and typewriter payoff.",
    sampleText:
      "Vox\ntypography\nanimations\nfeel so\nVox typography\nAa",
    accentClass: "text-yellow-300",
  },
  {
    id: "world-map-focus",
    stylePreset: "world-map-focus",
    name: "World Map Focus",
    description: "Editorial world atlas with one country highlighted in focus.",
    sampleText:
      "Why India matters in this story\nA world view with a single country pulled into focus for the audience.\nCOUNTRY: India",
    accentClass: "text-cyan-300",
  },
  {
    id: "editorial-bar-chart",
    stylePreset: "editorial-bar-chart",
    name: "Editorial Bar Chart",
    description: "Paper-grid data scene with serif headline and staggered hand-ink bars.",
    sampleText:
      "The rise and fall of energy costs\nMonthly averages illustrate how electricity prices moved between highs and lows, measured as a percentage of household income. Source: Eurostat.\nJAN|28|#d8de4e\nFEB|60|#d8de4e\nMAR|70|#d8de4e\nAPR|75|#d8de4e\nMAY|45|#d8de4e\nJUNE|20|#d8de4e\nJULY|83|#d8de4e\nAUG|64|#d8de4e\nSEPT|95|#d8de4e\nOCT|78|#d8de4e\nNOV|55|#d8de4e\nDEC|68|#d8de4e",
    accentClass: "text-lime-300",
  },
  {
    id: "editorial-stat-ring",
    stylePreset: "editorial-stat-ring",
    name: "Stat Ring Card",
    description: "Editorial percentage card with highlighted headline, count-up stat, and ring reveal.",
    sampleText:
      "The overwhelming [[scientific]] consensus on climate change\nAnalysis of peer-reviewed climate studies published between 2012 and 2020. Source: IPCC.\n97|%|#ef5a29",
    accentClass: "text-orange-300",
  },
  {
    id: "createdaley-opener",
    stylePreset: "createdaley-opener",
    name: "Createdaley Opener",
    description: "Dictionary-style opener with torn-paper reveal, phonetic line, and editorial definition copy.",
    sampleText:
      "createdaley\nkree-a-tuh-day-lee\nnoun\nto inspire others to make, design, or imagine something new while reminding them to support the movement",
    accentClass: "text-zinc-300",
  },
  {
    id: "chart-card",
    stylePreset: "chart-card",
    name: "Pie Chart Card",
    description: "Editorial pie-chart explainer with headline highlight and staggered legend reveal.",
    sampleText:
      "How [[Americans]] split their political loyalties\nBased on national survey data collected by Gallup in 2024, showing how U.S. adults identify politically across the two major parties and independents.\nDemocrats|49|#69bdfb\nRepublicans|49|#ff5a43\nOthers|2|#ddd8d1",
    accentClass: "text-sky-300",
  },
  {
    id: "news-clipping",
    stylePreset: "news-clipping",
    name: "News Clipping",
    description: "Newspaper card with badge, serif headline, and highlights.",
    sampleText:
      "Oct 27, 2022\nElon Musk Completes $44 Billion Deal to Own Twitter\nThe world's richest man closed his blockbuster purchase.",
    accentClass: "text-orange-300",
  },
];

export type TemplateDefinitionId = (typeof TEMPLATE_DEFINITIONS)[number]["id"];

export const TEMPLATE_DEFINITION_MAP: Record<TemplateDefinitionId, TemplateDefinition> =
  Object.fromEntries(
    TEMPLATE_DEFINITIONS.map((template) => [template.id, template]),
  ) as Record<TemplateDefinitionId, TemplateDefinition>;

export const getTemplateDefinition = (
  value: string | null | undefined,
): TemplateDefinition | null => {
  if (!value) {
    return null;
  }

  return TEMPLATE_DEFINITION_MAP[value as TemplateDefinitionId] ?? null;
};
