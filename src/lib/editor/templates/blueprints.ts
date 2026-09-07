import type {
  VersionTimeline,
  VideoFilterPreset,
} from "../types";
import { cloneVideoFilterPreset } from "../video-filters";

/**
 * Frame-accurate 41.9 second cut grid modelled on the compact city-film rhythm:
 * one long establishing beat, a short credit passage, then increasingly spacious
 * observational cuts. The bundled user-supplied track follows this same grid.
 */
export const NEW_DAY_PLACE_CUT_FRAMES = [
  0, 146, 192, 239, 286, 337, 391, 448, 504, 563, 621, 681, 741, 804, 869, 936,
  1006, 1081, 1165, 1257,
] as const;

const NEW_DAY_PLACE_ASSET_IDS = [
  "new-day-place-video-01",
  "new-day-place-video-02",
  "new-day-place-video-03",
  "new-day-place-video-04",
  "new-day-place-video-05",
  "new-day-place-video-06",
  "new-day-place-video-07",
  "new-day-place-video-08",
  "new-day-place-video-09",
  "new-day-place-video-10",
  "new-day-place-video-11",
  "new-day-place-video-12",
  "new-day-place-video-13",
  "new-day-place-video-14",
  "new-day-place-video-15",
  "new-day-place-video-16",
  "new-day-place-video-17",
  "new-day-place-video-18",
  "new-day-place-video-19",
] as const;

/** Shot-aware grading: warm natural light, cool atmospheric landscapes, and a
 * restrained cinematic baseline for rain, greenery, and neutral city scenes. */
export const NEW_DAY_PLACE_FILTER_PRESETS: readonly VideoFilterPreset[] = [
  "warm",       // Taj Mahal
  "warm",       // Goa coast
  "cool",       // Ladakh
  "cinematic",  // Pune monsoon
  "warm",       // Hawa Mahal
  "cinematic",  // Kerala backwaters
  "warm",       // Mehrangarh Fort
  "cool",       // Misty Kerala highlands
  "warm",       // Varanasi ghats
  "warm",       // Golden Temple
  "cinematic",  // India Gate
  "warm",       // Laxmi Vilas Palace
  "cool",       // Nohkalikai Falls
  "cool",       // Kashmir valley
  "warm",       // Kanchenjunga sunrise
  "warm",       // Kutch
  "cinematic",  // Munnar tea hills
  "warm",       // Ancient temple
  "warm",       // Varkala Beach
] as const;

const NEW_DAY_PLACE_SOURCE_CREDITS = [
  "TAJ MAHAL, AGRA  ·  VIDEO: CHANDAN KUMAR / PEXELS",
  "GOA COAST  ·  VIDEO: KARTIK NAIK / PEXELS",
  "LADAKH  ·  VIDEO: GAURAV GUPTA / PEXELS",
  "PUNE MONSOON  ·  VIDEO: ANIKET SURYAWANSHI / PEXELS",
  "HAWA MAHAL, JAIPUR  ·  VIDEO: ABHISHEK SHEKHAWAT / PEXELS",
  "KERALA BACKWATERS  ·  VIDEO: DHYEY PATEL / PEXELS",
  "MEHRANGARH FORT, JODHPUR  ·  VIDEO: ANIL SHARMA / PEXELS",
  "KERALA HIGHLANDS  ·  VIDEO: OVO FILMS / PEXELS",
  "VARANASI GHATS  ·  VIDEO: ARTO SURAJ / PEXELS",
  "GOLDEN TEMPLE, AMRITSAR  ·  VIDEO: SHALENDER KUMAR / PEXELS",
  "INDIA GATE, NEW DELHI  ·  VIDEO: IN OLD NEWS LLC / PEXELS",
  "LAXMI VILAS PALACE, VADODARA  ·  VIDEO: NIIHAR DOSHI / PEXELS",
  "NOHKALIKAI FALLS, MEGHALAYA  ·  VIDEO: VIKASH SINGH / PEXELS",
  "KASHMIR VALLEY  ·  VIDEO: HINDUSTANI LENS / PEXELS",
  "KANCHENJUNGA, SIKKIM  ·  VIDEO: ARIJIT DEY / PEXELS",
  "KUTCH, GUJARAT  ·  VIDEO: VIKASH SINGH / PEXELS",
  "MUNNAR TEA HILLS  ·  VIDEO: ANIL SHARMA / PEXELS",
  "ANCIENT INDIAN TEMPLE  ·  VIDEO: FILMLINE / PEXELS",
  "VARKALA BEACH, KERALA  ·  VIDEO: AERIAL GLIMPSES / PEXELS",
] as const;

const createNewDayPlaceClips = () =>
  NEW_DAY_PLACE_CUT_FRAMES.slice(0, -1).map((startFrame, index) => {
    const endFrame = NEW_DAY_PLACE_CUT_FRAMES[index + 1];
    return {
      id: `new-day-place-scene-${String(index + 1).padStart(2, "0")}`,
      assetId: NEW_DAY_PLACE_ASSET_IDS[index],
      kind: "video" as const,
      startFrame,
      endFrame,
      trimStartFrame: 0,
      trimEndFrame: endFrame - startFrame,
      volume: 0,
      videoFilter: cloneVideoFilterPreset(NEW_DAY_PLACE_FILTER_PRESETS[index]),
    };
  });

const createNewDayPlaceSourceCredits = (): VersionTimeline["textOverlays"] =>
  NEW_DAY_PLACE_CUT_FRAMES.slice(0, -1).map((startFrame, index) => ({
    id: `new-day-place-source-${String(index + 1).padStart(2, "0")}`,
    text: NEW_DAY_PLACE_SOURCE_CREDITS[index],
    startFrame,
    endFrame: NEW_DAY_PLACE_CUT_FRAMES[index + 1],
    x: 80,
    y: 88,
    fontSize: 14,
    color: "#f2ede3",
    fontFamily: "modern",
    fontWeight: 500,
    fontStyle: "normal",
    textAlign: "right",
    stylePreset: "classic",
    contrast: "outline",
    animation: { in: "fade", out: "fade", durationFrames: 4 },
  }));

/**
 * Editor-native starter projects. The ids in these blueprints are semantic
 * placeholders; instantiateTemplateBlueprint replaces them with session ids.
 */
export const FLAGSHIP_TEMPLATE_BLUEPRINTS = {
  "agent-demo-reel": {
    aspect: "reel_9_16",
    clips: [
      {
        id: "agent-demo-reel-video-01",
        assetId: "agent-demo-reel-video-01",
        kind: "video",
        startFrame: 0,
        endFrame: 240,
        trimStartFrame: 0,
        trimEndFrame: 240,
        volume: 0,
      },
      {
        id: "agent-demo-reel-video-02",
        assetId: "agent-demo-reel-video-02",
        kind: "video",
        startFrame: 240,
        endFrame: 480,
        trimStartFrame: 0,
        trimEndFrame: 240,
        volume: 0,
      },
      {
        id: "agent-demo-reel-video-03",
        assetId: "agent-demo-reel-video-03",
        kind: "video",
        startFrame: 480,
        endFrame: 570,
        trimStartFrame: 0,
        trimEndFrame: 90,
        volume: 0,
      },
    ],
    textOverlays: [
      {
        id: "agent-demo-reel-text-01",
        text: "MAKE",
        startFrame: 36,
        endFrame: 118,
        x: 50,
        y: 43,
        fontSize: 54,
        color: "#f7f4ed",
        fontFamily: "sans",
        fontWeight: 700,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "word-reveal", out: "fade", durationFrames: 14 },
      },
      {
        id: "agent-demo-reel-text-02",
        text: "A VIDEO.",
        startFrame: 104,
        endFrame: 232,
        x: 50,
        y: 56,
        fontSize: 78,
        color: "#f7f4ed",
        fontFamily: "sans",
        fontWeight: 800,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "punch", out: "fade", durationFrames: 12 },
      },
      {
        id: "agent-demo-reel-text-03",
        text: "BUT CAN IT",
        startFrame: 254,
        endFrame: 326,
        x: 50,
        y: 36,
        fontSize: 38,
        color: "#f7f4ed",
        fontFamily: "mono",
        fontWeight: 700,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "typewriter", out: "fade", durationFrames: 18 },
      },
      {
        id: "agent-demo-reel-text-04",
        text: "MAKE",
        startFrame: 308,
        endFrame: 398,
        x: 50,
        y: 49,
        fontSize: 62,
        color: "#f7f4ed",
        fontFamily: "sans",
        fontWeight: 800,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "rise", out: "fade", durationFrames: 14 },
      },
      {
        id: "agent-demo-reel-text-05",
        text: "THE CUT?",
        startFrame: 382,
        endFrame: 472,
        x: 50,
        y: 60,
        fontSize: 82,
        color: "#ff4f1f",
        fontFamily: "sans",
        fontWeight: 900,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "punch", out: "fade", durationFrames: 10 },
      },
      {
        id: "agent-demo-reel-text-06",
        text: "SEARCH.",
        startFrame: 490,
        endFrame: 535,
        x: 50,
        y: 44,
        fontSize: 54,
        color: "#f7f4ed",
        fontFamily: "mono",
        fontWeight: 700,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "slide-left", out: "fade", durationFrames: 10 },
      },
      {
        id: "agent-demo-reel-text-07",
        text: "FIND.",
        startFrame: 526,
        endFrame: 568,
        x: 50,
        y: 56,
        fontSize: 80,
        color: "#ff4f1f",
        fontFamily: "sans",
        fontWeight: 900,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "punch", durationFrames: 8 },
      },
    ],
    audioTracks: [
      {
        id: "agent-demo-reel-audio-01",
        assetId: "agent-demo-reel-audio-01",
        startFrame: 0,
        endFrame: 570,
        trimStartFrame: 0,
        trimEndFrame: 570,
        volume: 0.32,
        fadeInFrames: 10,
        fadeOutFrames: 24,
        muted: false,
      },
    ],
    transitions: [
      {
        id: "agent-demo-reel-transition-01",
        kind: "wipe",
        durationInFrames: 12,
        fromClipId: "agent-demo-reel-video-01",
        toClipId: "agent-demo-reel-video-02",
        direction: "left",
        easing: "ease-out",
      },
      {
        id: "agent-demo-reel-transition-02",
        kind: "fade",
        durationInFrames: 12,
        fromClipId: "agent-demo-reel-video-02",
        toClipId: "agent-demo-reel-video-03",
        easing: "ease-out",
      },
    ],
  },
  "one-number": {
    aspect: "reel_9_16",
    clips: [
      {
        id: "one-number-video-01",
        assetId: "one-number-video-01",
        kind: "video",
        startFrame: 0,
        endFrame: 180,
        trimStartFrame: 30,
        trimEndFrame: 210,
        volume: 0,
      },
      {
        id: "one-number-video-02",
        assetId: "one-number-video-02",
        kind: "video",
        startFrame: 180,
        endFrame: 368,
        trimStartFrame: 175,
        trimEndFrame: 363,
        volume: 0,
      },
    ],
    textOverlays: [
      {
        id: "one-number-context",
        text: "Q3 / PROGRESS REPORT",
        startFrame: 0,
        endFrame: 58,
        x: 50,
        y: 16,
        fontSize: 40,
        color: "#ff6b3d",
        fontFamily: "mono",
        fontWeight: 600,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "typewriter", out: "fade", durationFrames: 18 },
      },
      {
        id: "one-number-value",
        text: "73%",
        startFrame: 28,
        endFrame: 150,
        x: 50,
        y: 40,
        fontSize: 200,
        color: "#d7ff3f",
        fontFamily: "sans",
        fontWeight: 900,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "punch", out: "fade", durationFrames: 12 },
      },
      {
        id: "one-number-meaning",
        text: "OF THE ANNUAL GOAL\nREACHED THIS QUARTER",
        startFrame: 82,
        endFrame: 150,
        x: 50,
        y: 65,
        fontSize: 60,
        color: "#f2ede3",
        fontFamily: "sans",
        fontWeight: 800,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "word-reveal", out: "fade", durationFrames: 18 },
      },
      {
        id: "one-number-before",
        text: "THEN\n41%",
        startFrame: 158,
        endFrame: 246,
        x: 26,
        y: 30,
        fontSize: 68,
        color: "#f2ede3",
        fontFamily: "sans",
        fontWeight: 700,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "rise", out: "fade", durationFrames: 14 },
      },
      {
        id: "one-number-direction",
        text: "→",
        startFrame: 174,
        endFrame: 246,
        x: 50,
        y: 31,
        fontSize: 56,
        color: "#ff6b3d",
        fontFamily: "mono",
        fontWeight: 700,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "slide-left", out: "fade", durationFrames: 12 },
      },
      {
        id: "one-number-after",
        text: "NOW\n73%",
        startFrame: 166,
        endFrame: 246,
        x: 74,
        y: 30,
        fontSize: 72,
        color: "#d7ff3f",
        fontFamily: "sans",
        fontWeight: 900,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "punch", out: "fade", durationFrames: 12 },
      },
      {
        id: "one-number-delta",
        text: "+32 POINTS\nIN TWO YEARS",
        startFrame: 202,
        endFrame: 248,
        x: 50,
        y: 76,
        fontSize: 44,
        color: "#f2ede3",
        fontFamily: "mono",
        fontWeight: 700,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "typewriter", out: "fade", durationFrames: 16 },
      },
      {
        id: "one-number-takeaway",
        text: "Momentum changed\ndirection.",
        startFrame: 252,
        endFrame: 358,
        x: 50,
        y: 29,
        fontSize: 84,
        color: "#f2ede3",
        fontFamily: "serif",
        fontWeight: 700,
        fontStyle: "italic",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "word-reveal", durationFrames: 20 },
      },
      {
        id: "one-number-source",
        text: "DEMO DATA — REPLACE WITH YOUR SOURCE",
        startFrame: 286,
        endFrame: 358,
        x: 50,
        y: 89,
        fontSize: 42,
        color: "#f2ede3",
        fontFamily: "mono",
        fontWeight: 400,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        animation: { in: "fade", durationFrames: 16 },
      },
    ],
    audioTracks: [
      {
        id: "one-number-audio-01",
        assetId: "one-number-audio-01",
        startFrame: 0,
        endFrame: 358,
        trimStartFrame: 0,
        trimEndFrame: 358,
        volume: 0.24,
        fadeInFrames: 10,
        fadeOutFrames: 24,
        muted: false,
      },
    ],
    transitions: [
      {
        id: "one-number-transition-01",
        kind: "fade",
        durationInFrames: 10,
        fromClipId: "one-number-video-01",
        toClipId: "one-number-video-02",
        easing: "ease-out",
      },
    ],
  },
  "new-day-place": {
    aspect: "widescreen_16_9",
    clips: createNewDayPlaceClips(),
    textOverlays: [
      {
        id: "new-day-place-title",
        text: "BRAND NEW DAY",
        startFrame: 10,
        endFrame: 138,
        x: 50,
        y: 48,
        fontSize: 82,
        color: "#f2ede3",
        fontFamily: "modern",
        fontWeight: 700,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        contrast: "outline",
        animation: { in: "rise", out: "fade", durationFrames: 14 },
      },
      {
        id: "new-day-place-location",
        text: "INDIA",
        startFrame: 30,
        endFrame: 140,
        x: 50,
        y: 62,
        fontSize: 28,
        color: "#f2ede3",
        fontFamily: "modern",
        fontWeight: 600,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        contrast: "outline",
        animation: { in: "fade", out: "fade", durationFrames: 12 },
      },
      {
        id: "new-day-place-credit",
        text: "LICENSED FOOTAGE · PEXELS CREATORS",
        startFrame: 151,
        endFrame: 232,
        x: 88,
        y: 81,
        fontSize: 16,
        color: "#f2ede3",
        fontFamily: "modern",
        fontWeight: 500,
        fontStyle: "normal",
        textAlign: "right",
        stylePreset: "classic",
        contrast: "outline",
        animation: { in: "fade", out: "fade", durationFrames: 8 },
      },
      {
        id: "new-day-place-dedication",
        text: "INDIA IN\n19 SCENES",
        startFrame: 244,
        endFrame: 328,
        x: 50,
        y: 47,
        fontSize: 58,
        color: "#f2ede3",
        fontFamily: "modern",
        fontWeight: 700,
        fontStyle: "normal",
        textAlign: "center",
        stylePreset: "classic",
        contrast: "outline",
        animation: { in: "fade", out: "fade", durationFrames: 8 },
      },
      ...createNewDayPlaceSourceCredits(),
    ],
    audioTracks: [
      {
        id: "new-day-place-audio-01",
        assetId: "new-day-place-audio-01",
        startFrame: 0,
        endFrame: 1257,
        trimStartFrame: 0,
        trimEndFrame: 1257,
        volume: 1,
        fadeInFrames: 0,
        fadeOutFrames: 0,
        muted: false,
      },
    ],
    transitions: [],
  },
} satisfies Record<string, VersionTimeline>;

export type FlagshipTemplateId = keyof typeof FLAGSHIP_TEMPLATE_BLUEPRINTS;

/**
 * Clone a blueprint into a fresh editable timeline and inject caller-owned ids.
 * Transition endpoints are remapped, so blueprints never leak placeholder ids.
 */
export const instantiateTemplateBlueprint = (
  blueprint: VersionTimeline,
  createId: () => string,
): VersionTimeline => {
  const clipIds = new Map(blueprint.clips.map((clip) => [clip.id, createId()]));
  const textIds = new Map(
    blueprint.textOverlays.map((overlay) => [overlay.id, createId()]),
  );
  const audioIds = new Map(
    blueprint.audioTracks.map((track) => [track.id, createId()]),
  );

  return {
    aspect: blueprint.aspect,
    clips: blueprint.clips.map((clip) => ({
      ...clip,
      id: clipIds.get(clip.id) ?? clip.id,
    })),
    textOverlays: blueprint.textOverlays.map((overlay) => ({
      ...overlay,
      id: textIds.get(overlay.id) ?? overlay.id,
      ...(overlay.animation ? { animation: { ...overlay.animation } } : {}),
    })),
    audioTracks: blueprint.audioTracks.map((track) => ({
      ...track,
      id: audioIds.get(track.id) ?? track.id,
    })),
    transitions: blueprint.transitions.map((transition) => ({
      ...transition,
      id: createId(),
      fromClipId: clipIds.get(transition.fromClipId) ?? transition.fromClipId,
      toClipId: clipIds.get(transition.toClipId) ?? transition.toClipId,
    })),
  };
};

export const instantiateFlagshipTemplate = (
  templateId: FlagshipTemplateId,
  createId: () => string,
): VersionTimeline =>
  instantiateTemplateBlueprint(FLAGSHIP_TEMPLATE_BLUEPRINTS[templateId], createId);
