import { Img } from "remotion";
import type { TextMotionProject } from "@/lib/text-motion/types";
import { getSceneImage } from "./shared";

export const SceneImage = ({
  project,
  scene,
  opacityMultiplier = 1,
  fallbackToFirst = false,
}: {
  project: TextMotionProject;
  scene: TextMotionProject["scenes"][number];
  opacityMultiplier?: number;
  fallbackToFirst?: boolean;
}) => {
  const sceneImage = getSceneImage(project, scene, fallbackToFirst);

  if (!sceneImage) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: `${scene.imageX ?? 50}%`,
        top: `${scene.imageY ?? 50}%`,
        width: "100%",
        height: "100%",
        transform: `translate(-50%, -50%) scale(${scene.imageScale ?? 1})`,
        opacity: (scene.imageOpacity ?? 0.65) * opacityMultiplier,
        overflow: "hidden",
      }}
    >
      <Img
        src={sceneImage.dataUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  );
};
