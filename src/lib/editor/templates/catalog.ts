import {
  FLAGSHIP_TEMPLATE_BLUEPRINTS,
  instantiateTemplateBlueprint,
  type FlagshipTemplateId,
} from "./blueprints";
import type {
  AspectPreset,
  AssetRef,
  TextOverlayStylePreset,
  VersionTimeline,
} from "../types";

export interface TemplateDefinition {
  id: string;
  stylePreset: TextOverlayStylePreset;
  name: string;
  description: string;
  sampleText: string;
  accentClass: string;
  aspect?: AspectPreset;
  /** Elah-native editable starter timeline, when provided. */
  blueprint?: VersionTimeline;
  starterAssets?: {
    kind: "audio" | "image" | "video";
    name: string;
    mimeType: string;
    publicPath: string;
    attribution?: AssetRef["attribution"];
  }[];
}

const FLAGSHIP_TEMPLATE_ASSETS: Record<
  FlagshipTemplateId,
  NonNullable<TemplateDefinition["starterAssets"]>
> = {
  "agent-demo-reel": [
    {
      kind: "video",
      name: "Projected portrait",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/agent-demo-reel/projected-portrait.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/young-man-posing-with-colorful-projection-on-face-6491984/",
        creatorName: "cottonbro studio",
        creatorUrl: "https://www.pexels.com/@cottonbro",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Neon keyboard",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/agent-demo-reel/neon-keyboard.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/hands-typing-on-rgb-keyboard-in-low-light-35281906/",
        creatorName: "Azhaan Bashmil",
        creatorUrl: "https://www.pexels.com/@azhaan-bashmil-728761857",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Purple ink",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/agent-demo-reel/purple-ink.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/purple-ink-mixing-underwater-in-slow-motion-15168379/",
        creatorName: "Dan Cristian Pădureț",
        creatorUrl: "https://www.pexels.com/@paduret",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "audio",
      name: "Piano Synth Loop",
      mimeType: "audio/mpeg",
      publicPath: "/starter-assets/agent-demo-reel/piano-synth-loop.mp3",
      attribution: {
        provider: "freesound",
        sourceUrl: "https://freesound.org/people/EEE3333E/sounds/854558/",
        creatorName: "EEE3333E",
        creatorUrl: "https://freesound.org/people/EEE3333E/",
        licenseName: "CC0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        attributionRequired: false,
      },
    },
  ],
  "one-number": [
    {
      kind: "video",
      name: "Chart review",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/one-number/chart-review-graded.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl: "https://www.pexels.com/video/people-looking-at-a-chart-5020446/",
        creatorName: "Antoni Shkraba",
        creatorUrl: "https://www.pexels.com/@shkrabaanthony",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Team payoff",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/one-number/team-payoff-graded.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl: "https://www.pexels.com/video/team-hands-together-9464870/",
        creatorName: "Monstera Production",
        creatorUrl: "https://www.pexels.com/@gabby-k",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "audio",
      name: "Neural Patterning",
      mimeType: "audio/mpeg",
      publicPath: "/starter-assets/one-number/neural-patterning.mp3",
      attribution: {
        provider: "freesound",
        sourceUrl: "https://freesound.org/people/f-r-a-g-i-l-e/sounds/484045/",
        creatorName: "f-r-a-g-i-l-e",
        creatorUrl: "https://freesound.org/people/f-r-a-g-i-l-e/",
        licenseName: "CC0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        attributionRequired: false,
      },
    },
  ],
  "editorial-explainer": [
    {
      kind: "image",
      name: "Explainer scene 01",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/alexanderplatz-demonstration-1989.jpg",
    },
    {
      kind: "image",
      name: "Explainer scene 02",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/schabowski-press-conference-1989.jpg",
    },
    {
      kind: "image",
      name: "Explainer scene 03",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/bornholmer-strasse-opening-1989.jpg",
    },
  ],
  "product-reveal": [
    {
      kind: "image",
      name: "Product reveal detail",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/schabowski-press-conference-1989.jpg",
    },
    {
      kind: "image",
      name: "Product reveal in use",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/brandenburg-gate-crowds-1989.jpg",
    },
    {
      kind: "image",
      name: "Product reveal hero",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/german-reunification-1990.jpg",
    },
  ],
  "social-promo": [
    {
      kind: "image",
      name: "Social promo hook",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/brandenburg-gate-crowds-1989.jpg",
    },
    {
      kind: "image",
      name: "Social promo proof",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/alexanderplatz-demonstration-1989.jpg",
    },
    {
      kind: "image",
      name: "Social promo call to action",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/german-reunification-1990.jpg",
    },
  ],
  "documentary-cut": [
    {
      kind: "image",
      name: "Documentary opening",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/alexanderplatz-demonstration-1989.jpg",
    },
    {
      kind: "image",
      name: "Documentary turning point",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/schabowski-press-conference-1989.jpg",
    },
    {
      kind: "image",
      name: "Documentary resolution",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/bornholmer-strasse-opening-1989.jpg",
    },
  ],
  "data-pulse": [
    {
      kind: "image",
      name: "Data pulse opening",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/german-reunification-1990.jpg",
    },
    {
      kind: "image",
      name: "Data pulse context",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/brandenburg-gate-crowds-1989.jpg",
    },
    {
      kind: "image",
      name: "Data pulse close",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/alexanderplatz-demonstration-1989.jpg",
    },
  ],
  "quote-reel": [
    {
      kind: "image",
      name: "Quote reel opening",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/schabowski-press-conference-1989.jpg",
    },
    {
      kind: "image",
      name: "Quote reel emphasis",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/brandenburg-gate-crowds-1989.jpg",
    },
    {
      kind: "image",
      name: "Quote reel close",
      mimeType: "image/jpeg",
      publicPath: "/starter-assets/berlin-wall/german-reunification-1990.jpg",
    },
  ],
};

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

const TEMPLATE_CATALOG_SOURCE: TemplateDefinition[] = [
  {
    id: "agent-demo-reel",
    stylePreset: "classic",
    name: "Agent Demo Reel",
    description:
      "The WebMCP-created Make the Cut reel rebuilt as editable footage, animated text, and transitions.",
    sampleText: "MAKE A VIDEO.\nMAKE THE CUT.",
    accentClass: "text-violet-300",
    aspect: "reel_9_16",
    starterAssets: FLAGSHIP_TEMPLATE_ASSETS["agent-demo-reel"],
    blueprint: FLAGSHIP_TEMPLATE_BLUEPRINTS["agent-demo-reel"],
  },
  {
    id: "one-number",
    stylePreset: "classic",
    name: "One Number Changes Everything",
    description:
      "One metric becomes context, comparison, and payoff with editable footage, kinetic type, and a full-length soundtrack.",
    sampleText: "73%\nOF THE GOAL REACHED THIS QUARTER",
    accentClass: "text-orange-500",
    aspect: "reel_9_16",
    starterAssets: FLAGSHIP_TEMPLATE_ASSETS["one-number"],
    blueprint: FLAGSHIP_TEMPLATE_BLUEPRINTS["one-number"],
  },
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
  {
    id: "vox-pull-quote",
    stylePreset: "vox-pull-quote",
    name: "Vox Pull Quote",
    description:
      "Explainer-style pull quote on a dark card with word-by-word reveal, yellow highlighter sweep, and attribution line. Wrap the key phrase in [[double brackets]].",
    sampleText:
      "THE ARGUMENT\nWe didn't just redraw the map — we redrew [[who gets to belong]].\n— Dr. Lena Hartmann, Historian",
    accentClass: "text-yellow-300",
  },
  {
    id: "harris-marker",
    stylePreset: "harris-marker",
    name: "Marker Headline",
    description:
      "Documentary headline stack with hard line cuts, a hand-drawn red marker underline, and a scribbled circle around a [[bracketed]] word.",
    sampleText:
      "WHY MAPS LIE\nEVERY MAP\nYOU'VE EVER SEEN\nIS [[WRONG]]",
    accentClass: "text-red-400",
  },
  {
    id: "harris-location",
    stylePreset: "harris-location",
    name: "Location Stamp",
    description:
      "Field-footage location lower third: typewriter place name, mono coordinates, and a red archive stamp.",
    sampleText:
      "SVALBARD, NORWAY\n78.2232 N, 15.6267 E\nARCHIVE / 1993",
    accentClass: "text-red-300",
  },
  {
    id: "editorial-explainer",
    stylePreset: "classic",
    name: "Editorial Explainer",
    description:
      "A three-scene editorial explainer with image beats, kinetic headlines, native transitions, and a paced audio bed.",
    sampleText: "THE SIGNAL\nBEHIND THE STORY",
    accentClass: "text-orange-300",
    starterAssets: FLAGSHIP_TEMPLATE_ASSETS["editorial-explainer"],
    blueprint: FLAGSHIP_TEMPLATE_BLUEPRINTS["editorial-explainer"],
  },
  {
    id: "product-reveal",
    stylePreset: "classic",
    name: "Product Reveal",
    description:
      "A cinematic product launch cut with a sharp introduction, benefit beat, call to action, and native audio fades in the sidecar.",
    sampleText: "INTRODUCING\nA SMALLER WAY FORWARD",
    accentClass: "text-red-300",
    starterAssets: FLAGSHIP_TEMPLATE_ASSETS["product-reveal"],
    blueprint: FLAGSHIP_TEMPLATE_BLUEPRINTS["product-reveal"],
  },
  {
    id: "social-promo",
    stylePreset: "classic",
    name: "Social Promo",
    description:
      "A fast three-beat social promo built for a hard hook, proof point, and unmistakable next action.",
    sampleText: "STOP SCROLLING.\nSTART MAKING.",
    accentClass: "text-yellow-300",
    starterAssets: FLAGSHIP_TEMPLATE_ASSETS["social-promo"],
    blueprint: FLAGSHIP_TEMPLATE_BLUEPRINTS["social-promo"],
  },
  {
    id: "documentary-cut",
    stylePreset: "classic",
    name: "Documentary Cut",
    description:
      "A paced three-act documentary opener with archival imagery, editorial typography, and native wipe and slide transitions.",
    sampleText: "THE NIGHT\nTHE WALL OPENED",
    accentClass: "text-amber-300",
    starterAssets: FLAGSHIP_TEMPLATE_ASSETS["documentary-cut"],
    blueprint: FLAGSHIP_TEMPLATE_BLUEPRINTS["documentary-cut"],
  },
  {
    id: "data-pulse",
    stylePreset: "classic",
    name: "Data Pulse",
    description:
      "A high-contrast statistic reel that alternates punch, rise, and word-reveal motion across three editable beats.",
    sampleText: "95%\nSTILL UNEXPLORED",
    accentClass: "text-orange-300",
    starterAssets: FLAGSHIP_TEMPLATE_ASSETS["data-pulse"],
    blueprint: FLAGSHIP_TEMPLATE_BLUEPRINTS["data-pulse"],
  },
  {
    id: "quote-reel",
    stylePreset: "classic",
    name: "Quote Reel",
    description:
      "An image-led editorial quote sequence with deliberate pacing, serif emphasis, and browser-native text motion.",
    sampleText: "WE DIDN’T JUST\nREDRAW THE MAP.",
    accentClass: "text-red-300",
    starterAssets: FLAGSHIP_TEMPLATE_ASSETS["quote-reel"],
    blueprint: FLAGSHIP_TEMPLATE_BLUEPRINTS["quote-reel"],
  },
];

/** Only verified, Elah-native templates are published. Retired definitions remain above for migration context. */
export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = TEMPLATE_CATALOG_SOURCE.filter(
  (template) => template.id === "agent-demo-reel" || template.id === "one-number",
);

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

export const getTemplateBlueprint = (
  value: string | null | undefined,
): VersionTimeline | null => getTemplateDefinition(value)?.blueprint ?? null;

export const instantiateTemplate = (
  value: string | null | undefined,
  createId: () => string,
): VersionTimeline | null => {
  const blueprint = value
    ? FLAGSHIP_TEMPLATE_BLUEPRINTS[value as FlagshipTemplateId]
    : undefined;
  return blueprint ? instantiateTemplateBlueprint(blueprint, createId) : null;
};
