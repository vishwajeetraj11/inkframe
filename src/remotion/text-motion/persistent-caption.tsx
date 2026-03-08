import { interpolate, useCurrentFrame } from "remotion";
import type { TextMotionProject } from "@/lib/text-motion/types";
import { FONT_STACK_BY_FAMILY } from "./shared";
export const PersistentCaption = ({
  scene,
  index,
  total,
  project,
}: {
  scene: TextMotionProject["scenes"][number];
  index: number;
  total: number;
  project: TextMotionProject;
}) => {
  const frame = useCurrentFrame();
  const isGridKinetic = project.template === "grid-kinetic";
  const opacity = interpolate(frame, [0, 8], [0, isGridKinetic ? 0.76 : 0.92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = isGridKinetic
    ? 16 + index * (34 / Math.max(1, total))
    : 14 + index * (62 / Math.max(1, total));

  return (
    <div
      style={{
        position: "absolute",
        left: isGridKinetic ? "6.2%" : "5.5%",
        top: `${y}%`,
        maxWidth: isGridKinetic ? "18%" : "32%",
        opacity,
        color: project.theme.textColor,
        fontFamily: isGridKinetic
          ? FONT_STACK_BY_FAMILY.condensed
          : FONT_STACK_BY_FAMILY[scene.fontFamily] ?? FONT_STACK_BY_FAMILY.sans,
        fontWeight: isGridKinetic ? 700 : Math.max(500, scene.fontWeight - 300),
        fontStyle: scene.fontStyle,
        fontSize: isGridKinetic ? 24 : 28,
        lineHeight: 0.94,
        letterSpacing: isGridKinetic ? -0.9 : -0.2,
        textAlign: "left",
        textTransform: isGridKinetic ? "lowercase" : "none",
        textShadow: "0 4px 10px rgba(0,0,0,0.3)",
      }}
    >
      {scene.text}
    </div>
  );
};

