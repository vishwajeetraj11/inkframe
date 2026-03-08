import { AbsoluteFill, Sequence } from "remotion";
import type { TextMotionProject } from "@/lib/text-motion/types";
import { getTextMotionDurationInFrames } from "@/lib/text-motion/utils";
import { DefaultSceneView } from "./text-motion/default-scene-view";
import { GridKineticSceneView } from "./text-motion/grid-kinetic";
import { PersistentCaption } from "./text-motion/persistent-caption";
import { PhotoCardSceneView } from "./text-motion/photo-card";

export interface TextMotionCompositionProps extends Record<string, unknown> {
  project: TextMotionProject;
}

export const TextMotionComposition = ({
  project,
}: TextMotionCompositionProps) => {
  const durationInFrames = getTextMotionDurationInFrames(project);
  const sequencedScenes = project.scenes.map((scene, index) => {
    const from = project.scenes
      .slice(0, index)
      .reduce((sum, item) => sum + Math.max(1, item.durationInFrames), 0);
    const sceneDuration = Math.max(1, scene.durationInFrames);

    return {
      scene,
      from,
      sceneDuration,
      end: from + sceneDuration,
    };
  });
  const persistentScenes =
    project.template === "photo-card"
      ? []
      : sequencedScenes.filter(({ scene }) => scene.keepOnScreen === true).slice(-4);

  return (
    <AbsoluteFill>
      {sequencedScenes.map(({ scene, from, sceneDuration }) => {
        return (
          <Sequence key={scene.id} from={from} durationInFrames={sceneDuration}>
            {project.template === "grid-kinetic" ? (
              <GridKineticSceneView
                scene={scene}
                project={project}
                hasPersistentRail={persistentScenes.length > 0}
              />
            ) : project.template === "photo-card" ? (
              <PhotoCardSceneView scene={scene} project={project} />
            ) : (
              <DefaultSceneView
                scene={scene}
                project={project}
                hasPersistentRail={persistentScenes.length > 0}
              />
            )}
          </Sequence>
        );
      })}

      {persistentScenes.map(({ scene, end }, index) => (
        <Sequence
          key={`persist-${scene.id}`}
          from={end}
          durationInFrames={Math.max(1, durationInFrames - end)}
        >
          <AbsoluteFill style={{ pointerEvents: "none" }}>
            <PersistentCaption
              scene={scene}
              index={index}
              total={persistentScenes.length}
              project={project}
            />
          </AbsoluteFill>
        </Sequence>
      ))}

      <Sequence from={Math.max(0, durationInFrames - 1)} durationInFrames={1}>
        <AbsoluteFill style={{ backgroundColor: "transparent" }} />
      </Sequence>
    </AbsoluteFill>
  );
};
