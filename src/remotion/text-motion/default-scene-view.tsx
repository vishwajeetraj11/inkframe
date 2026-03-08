import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { TextMotionProject } from "@/lib/text-motion/types";
import { SceneImage } from "./scene-image";
import {
  FONT_STACK_BY_FAMILY,
  getAnimatedStyle,
  renderTypewriterText,
  splitTextWithAccent,
} from "./shared";
export const DefaultSceneView = ({
  scene,
  project,
  hasPersistentRail,
}: {
  scene: TextMotionProject["scenes"][number];
  project: TextMotionProject;
  hasPersistentRail: boolean;
}) => {
  const frame = useCurrentFrame();
  const durationInFrames = Math.max(1, scene.durationInFrames);
  const animatedStyle = getAnimatedStyle(scene.animation, frame, durationInFrames);

  const displayText =
    scene.animation === "typewriter"
      ? renderTypewriterText(scene.text, frame, durationInFrames)
      : scene.text;
  const parts = splitTextWithAccent(displayText, scene.accentWord);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${project.theme.backgroundFrom}, ${project.theme.backgroundTo})`,
        alignItems: "center",
        justifyContent: "center",
        padding: "8%",
      }}
    >
      <SceneImage project={project} scene={scene} />

      <div
        style={{
          ...animatedStyle,
          maxWidth: hasPersistentRail ? "60%" : "90%",
          marginLeft: hasPersistentRail ? "28%" : "0%",
          color: project.theme.textColor,
          fontSize: 84,
          lineHeight: 1.06,
          fontFamily: FONT_STACK_BY_FAMILY[scene.fontFamily] ?? FONT_STACK_BY_FAMILY.sans,
          fontWeight: scene.fontWeight,
          fontStyle: scene.fontStyle,
          textAlign: "center",
          letterSpacing: -1.1,
          textWrap: "balance",
          textShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        {parts.map((part, index) =>
          index % 2 === 1 ? (
            <span
              key={`${scene.id}-${index}`}
              style={{
                color: project.theme.accentColor,
              }}
            >
              {part}
            </span>
          ) : (
            <span key={`${scene.id}-${index}`}>{part}</span>
          ),
        )}
      </div>
    </AbsoluteFill>
  );
};

