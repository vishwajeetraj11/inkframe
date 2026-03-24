import {
  bruh,
  ding,
  mouseClick,
  pageTurn,
  shutterModern,
  shutterOld,
  uiSwitch,
  vineBoom,
  whip,
  whoosh,
  windowsXpError,
} from "@remotion/sfx";

export const REMOTION_SFX_LIBRARY = [
  {
    id: "whoosh",
    label: "Whoosh",
    url: whoosh,
    defaultDurationInFrames: 30,
  },
  {
    id: "page-turn",
    label: "Page Turn",
    url: pageTurn,
    defaultDurationInFrames: 36,
  },
  {
    id: "whip",
    label: "Whip",
    url: whip,
    defaultDurationInFrames: 24,
  },
  {
    id: "mouse-click",
    label: "Mouse Click",
    url: mouseClick,
    defaultDurationInFrames: 8,
  },
  {
    id: "ui-switch",
    label: "UI Switch",
    url: uiSwitch,
    defaultDurationInFrames: 10,
  },
  {
    id: "shutter-modern",
    label: "Shutter Modern",
    url: shutterModern,
    defaultDurationInFrames: 10,
  },
  {
    id: "shutter-old",
    label: "Shutter Old",
    url: shutterOld,
    defaultDurationInFrames: 12,
  },
  {
    id: "ding",
    label: "Ding",
    url: ding,
    defaultDurationInFrames: 20,
  },
  {
    id: "bruh",
    label: "Bruh",
    url: bruh,
    defaultDurationInFrames: 28,
  },
  {
    id: "vine-boom",
    label: "Vine Boom",
    url: vineBoom,
    defaultDurationInFrames: 24,
  },
  {
    id: "windows-xp-error",
    label: "Windows XP Error",
    url: windowsXpError,
    defaultDurationInFrames: 30,
  },
] as const;

export type RemotionSfxId = (typeof REMOTION_SFX_LIBRARY)[number]["id"];

export const getRemotionSfxById = (
  id: RemotionSfxId,
): (typeof REMOTION_SFX_LIBRARY)[number] | undefined =>
  REMOTION_SFX_LIBRARY.find((effect) => effect.id === id);
