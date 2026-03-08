import { MAX_DURATION_FRAMES } from "../lib/editor/constants";
import { createEmptyVersionTimeline } from "../lib/editor/defaults";
import type { AspectPreset } from "../lib/editor/types";
import { Composition } from "remotion";
import {
  EditorComposition,
  type EditorCompositionProps,
} from "./EditorComposition";
import {
  TextMotionComposition,
  type TextMotionCompositionProps,
} from "./TextMotionComposition";

const getDefaultProps = (aspect: AspectPreset): EditorCompositionProps => ({
  version: createEmptyVersionTimeline(aspect),
  assetSources: {},
  renderMode: "render",
});

const getTextMotionDefaultProps = (
  aspect: AspectPreset,
): TextMotionCompositionProps => ({
  project: {
    title: "Text Motion",
    aspect,
    template: "default",
    theme: {
      backgroundFrom: "#0f172a",
      backgroundTo: "#1e293b",
      textColor: "#f8fafc",
      accentColor: "#67e8f9",
    },
    imageAssets: [],
    scenes: [
      {
        id: "scene-1",
        text: "Add your first motion line.",
        durationInFrames: 60,
        animation: "slide-up",
        fontFamily: "sans",
        fontWeight: 700,
        fontStyle: "normal",
      },
    ],
  },
});

export const RemotionRoot = () => {
  const reelTextProject = getTextMotionDefaultProps("reel_9_16").project;
  const widescreenTextProject =
    getTextMotionDefaultProps("widescreen_16_9").project;

  return (
    <>
      <Composition
        id="reel-9-16"
        component={EditorComposition}
        durationInFrames={MAX_DURATION_FRAMES}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={getDefaultProps("reel_9_16")}
      />

      <Composition
        id="widescreen-16-9"
        component={EditorComposition}
        durationInFrames={MAX_DURATION_FRAMES}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={getDefaultProps("widescreen_16_9")}
      />

      <Composition
        id="text-motion-reel-9-16"
        component={TextMotionComposition}
        durationInFrames={MAX_DURATION_FRAMES}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ project: reelTextProject }}
      />

      <Composition
        id="text-motion-widescreen-16-9"
        component={TextMotionComposition}
        durationInFrames={MAX_DURATION_FRAMES}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ project: widescreenTextProject }}
      />
    </>
  );
};
