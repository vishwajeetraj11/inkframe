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
  "new-day-place": [
    {
      kind: "video",
      name: "Taj Mahal, Agra",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/taj-mahal-agra.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/majestic-view-of-the-taj-mahal-in-agra-india-34379970/",
        creatorName: "Chandan Kumar",
        creatorUrl: "https://www.pexels.com/@chandan-kumar-566203332",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Goa coast aerial",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/goa-beach-drone.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/drone-view-of-a-beach-resort-in-goa-india-15455610/",
        creatorName: "kartik naik",
        creatorUrl: "https://www.pexels.com/@kartik-naik-447172211",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Ladakh mountain panorama",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/ladakh-mountains.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/stunning-panorama-of-ladakh-s-rugged-mountains-30412767/",
        creatorName: "Gaurav Gupta",
        creatorUrl: "https://www.pexels.com/@gaurav-gupta-2148434222",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Pune monsoon",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/pune-monsoon.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/tropical-rainfall-on-lush-greenery-in-pune-32628145/",
        creatorName: "Aniket Suryawanshi",
        creatorUrl: "https://www.pexels.com/@aniket-suryawanshi-480804303",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Hawa Mahal, Jaipur",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/hawa-mahal-jaipur.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/the-hawa-mahal-palace-in-jaipur-india-27052515/",
        creatorName: "Abhishek Shekhawat",
        creatorUrl: "https://www.pexels.com/@absoluteabhi",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Kerala backwaters",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/kerala-backwaters.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/serene-kerala-backwaters-boat-journey-35576146/",
        creatorName: "Dhyey Patel",
        creatorUrl: "https://www.pexels.com/@dhyey237",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Mehrangarh Fort, Jodhpur",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/mehrangarh-fort.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/aerial-view-of-majestic-mehrangarh-fort-in-jodhpur-31031043/",
        creatorName: "Anil Sharma",
        creatorUrl: "https://www.pexels.com/@shootsaga",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Misty Kerala highlands",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/kerala-misty-hills.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/drone-view-of-foggy-kerala-landscape-34838676/",
        creatorName: "OvO Films",
        creatorUrl: "https://www.pexels.com/@ovo-films-2153386936",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Varanasi ghats",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/varanasi-ghats.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/vibrant-varanasi-ghats-along-the-ganges-river-37110601/",
        creatorName: "Arto Suraj",
        creatorUrl: "https://www.pexels.com/@artosuraj",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Golden Temple, Amritsar",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/golden-temple-amritsar.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl: "https://www.pexels.com/video/golden-temple-in-india-6583039/",
        creatorName: "shalender kumar",
        creatorUrl: "https://www.pexels.com/@shalenderkumar",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "India Gate, New Delhi",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/india-gate-delhi.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl: "https://www.pexels.com/video/india-gate-in-new-delhi-india-20794139/",
        creatorName: "In Old News LLC",
        creatorUrl: "https://www.pexels.com/@in-old-news-llc-338724185",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Laxmi Vilas Palace, Vadodara",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/laxmi-vilas-palace.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/historic-laxmi-vilas-palace-in-vadodara-35167231/",
        creatorName: "Niihar Doshi",
        creatorUrl: "https://www.pexels.com/@niihar2001",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Nohkalikai Falls, Meghalaya",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/nohkalikai-falls.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/tallest-plunge-waterfall-in-sheer-mountains-nohkalikai-falls-in-meghalaya-near-cherrapunji-india-aerial-drone-shot-28398824/",
        creatorName: "Vikash Singh",
        creatorUrl: "https://www.pexels.com/@vikashkr50",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Kashmir valley",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/kashmir-valley.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl: "https://www.pexels.com/video/aerial-views-of-kashmir-valley-19674205/",
        creatorName: "Hindustani Lens",
        creatorUrl: "https://www.pexels.com/@pixzium",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Kanchenjunga sunrise, Sikkim",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/kanchenjunga-sunrise.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/breathtaking-sunrise-at-kanchenjunga-peaks-29586895/",
        creatorName: "Arijit Dey",
        creatorUrl: "https://www.pexels.com/@arijit-dey-830130595",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Dhordo, Kutch",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/kutch-road.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/hut-house-at-dhordo-white-run-kutch-gujarat-india-hut-hotel-27089235/",
        creatorName: "Vikash Singh",
        creatorUrl: "https://www.pexels.com/@vikashkr50",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Munnar tea hills",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/munnar-tea-hills.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/breathtaking-aerial-view-of-lush-munnar-hills-35440607/",
        creatorName: "Anil Sharma",
        creatorUrl: "https://www.pexels.com/@shootsaga",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Ancient Indian temple",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/ancient-indian-temple.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/ancient-indian-temple-architecture-in-nature-30632229/",
        creatorName: "Filmline",
        creatorUrl: "https://www.pexels.com/@filmline-2149060806",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "video",
      name: "Varkala Beach, Kerala",
      mimeType: "video/mp4",
      publicPath: "/starter-assets/new-day-india/varkala-beach.mp4",
      attribution: {
        provider: "pexels",
        sourceUrl:
          "https://www.pexels.com/video/aerial-view-of-varkala-beach-kerala-coastline-29041047/",
        creatorName: "Aerial Glimpses",
        creatorUrl: "https://www.pexels.com/@aerialglimpses",
        licenseName: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionRequired: false,
      },
    },
    {
      kind: "audio",
      name: "Brand New Day — Tokyo Edition",
      mimeType: "audio/mpeg",
      publicPath: "/starter-assets/new-day-india/brand-new-day-tokyo-edition.mp3",
    },
  ],
};

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
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
    id: "new-day-place",
    stylePreset: "classic",
    name: "New Day — India Edition",
    description:
      "A 41.9-second portrait of India's monuments, coast, mountains, monsoon, and backwaters with 19 music-ready hard cuts and visible creator credits.",
    sampleText: "BRAND NEW DAY\nINDIA EDITION\nINDIA IN 19 SCENES",
    accentClass: "text-red-500",
    aspect: "widescreen_16_9",
    starterAssets: FLAGSHIP_TEMPLATE_ASSETS["new-day-place"],
    blueprint: FLAGSHIP_TEMPLATE_BLUEPRINTS["new-day-place"],
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
