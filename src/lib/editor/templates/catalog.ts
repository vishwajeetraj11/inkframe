import type { TextOverlayStylePreset } from "../types";

export interface TemplateDefinition {
  id: string;
  stylePreset: TextOverlayStylePreset;
  name: string;
  description: string;
  sampleText: string;
  accentClass: string;
  starterAssets?: {
    kind: "image";
    name: string;
    mimeType: string;
    publicPath: string;
  }[];
}

const BERLIN_WALL_TIMELINE_STARTER_ASSETS: NonNullable<
  TemplateDefinition["starterAssets"]
> = [
  {
    kind: "image",
    name: "Alexanderplatz demonstration, 4 November 1989",
    mimeType: "image/jpeg",
    publicPath: "/starter-assets/berlin-wall/alexanderplatz-demonstration-1989.jpg",
  },
  {
    kind: "image",
    name: "Gunter Schabowski press conference, 9 November 1989",
    mimeType: "image/jpeg",
    publicPath: "/starter-assets/berlin-wall/schabowski-press-conference-1989.jpg",
  },
  {
    kind: "image",
    name: "Bornholmer Strasse border opening, 10 November 1989",
    mimeType: "image/jpeg",
    publicPath: "/starter-assets/berlin-wall/bornholmer-strasse-opening-1989.jpg",
  },
  {
    kind: "image",
    name: "Berlin Wall crowds at Brandenburg Gate, November 1989",
    mimeType: "image/jpeg",
    publicPath: "/starter-assets/berlin-wall/brandenburg-gate-crowds-1989.jpg",
  },
  {
    kind: "image",
    name: "German reunification, October 1990",
    mimeType: "image/jpeg",
    publicPath: "/starter-assets/berlin-wall/german-reunification-1990.jpg",
  },
];

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: "vox-timeline",
    stylePreset: "vox-timeline",
    name: "Vox Timeline",
    description: "Image-led historical timeline with a persistent chronology strip and active event card.",
    sampleText:
      "HOW IT HAPPENED\nThe fall of the Berlin Wall\n1989|Protests spread|Demonstrations grow across East Germany.\nNov 9|Press conference|A botched announcement sets crowds in motion.\nNov 9|Checkpoint opens|Border guards begin letting Berliners through.\nNov 10|Wall breached|People climb the wall and start chipping it apart.\n1990|Germany reunifies|The Cold War map of Europe begins to change.",
    accentClass: "text-yellow-300",
    starterAssets: BERLIN_WALL_TIMELINE_STARTER_ASSETS,
  },
  {
    id: "vox-timeline-ribbon",
    stylePreset: "vox-timeline-ribbon",
    name: "Timeline Ribbon",
    description: "Documentary ribbon timeline with a lower-third chronology strip and floating active event card.",
    sampleText:
      "HOW IT HAPPENED\nThe fall of the Berlin Wall\n1989|Protests spread|Demonstrations grow across East Germany.\nNov 9|Press conference|A botched announcement sets crowds in motion.\nNov 9|Checkpoint opens|Border guards begin letting Berliners through.\nNov 10|Wall breached|People climb the wall and start chipping it apart.\n1990|Germany reunifies|The Cold War map of Europe begins to change.",
    accentClass: "text-amber-300",
    starterAssets: BERLIN_WALL_TIMELINE_STARTER_ASSETS,
  },
  {
    id: "vox-timeline-ledger",
    stylePreset: "vox-timeline-ledger",
    name: "Timeline Ledger",
    description: "Archival ledger layout that keeps the full chronology visible while spotlighting one active event.",
    sampleText:
      "HOW IT HAPPENED\nThe fall of the Berlin Wall\n1989|Protests spread|Demonstrations grow across East Germany.\nNov 9|Press conference|A botched announcement sets crowds in motion.\nNov 9|Checkpoint opens|Border guards begin letting Berliners through.\nNov 10|Wall breached|People climb the wall and start chipping it apart.\n1990|Germany reunifies|The Cold War map of Europe begins to change.",
    accentClass: "text-orange-300",
    starterAssets: BERLIN_WALL_TIMELINE_STARTER_ASSETS,
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
    id: "regional-map-focus",
    stylePreset: "regional-map-focus",
    name: "Regional Map Focus",
    description: "Documentary regional atlas zoom with country-or-border emphasis and a compact location label.",
    sampleText:
      "Why this border mattered\nA regional atlas zoom shows the local strategic context.\nPRIMARY: Iran\nSECONDARY: Iraq\nLABEL: Iran-Iraq boundary\nYEAR: 1975\nFOCUS: border",
    accentClass: "text-amber-300",
  },
  {
    id: "film-frame-gallery",
    stylePreset: "film-frame-gallery",
    name: "Film Frame Gallery",
    description: "Single-image film gate with archival matte, subtle drift, and a compact editorial caption.",
    sampleText:
      "The night the wall opened\nA framed archival image sequence from the fall of the Berlin Wall.\nLOCATION: Berlin\nYEAR: 1989",
    accentClass: "text-amber-200",
    starterAssets: BERLIN_WALL_TIMELINE_STARTER_ASSETS,
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
      "Most of our ocean remains [[unexplored]]\nNOAA says humans have explored only about 5% of the ocean, leaving 95% still unexplored.\n95|%|#ef5a29",
    accentClass: "text-orange-300",
  },
  {
    id: "editorial-seat-arc",
    stylePreset: "editorial-seat-arc",
    name: "Editorial Seat Arc",
    description: "Parliament-style semicircle with highlighted headline, dotted arc segments, and leader-line labels.",
    sampleText:
      "The current [[balance of power]] in the UK Parliament\nData from the 2024 general election: Labour holds about 63% of seats, Conservatives around 19%, with the remainder shared among smaller parties and independents. Source: UK Parliament & Commons Library.\nLabour|411|#dd6b66\nOthers|118|#e8e2d7\nConservative|121|#8ed7f0",
    accentClass: "text-yellow-300",
  },
  {
    id: "createdaley-opener",
    stylePreset: "createdaley-opener",
    name: "Dictionary Animation",
    description: "Typing animation with dictionary-style wordmark, pronunciation line, and editorial definition copy.",
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
