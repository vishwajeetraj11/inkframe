import { nanoid } from "nanoid";
import type {
  TextMotionImageAsset,
  TextMotionProject,
  TextMotionScene,
  TextMotionTemplate,
} from "@/lib/text-motion/types";
import { sanitizeTextMotionProject } from "@/lib/text-motion/utils";

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Failed to read image."));
    };
    reader.onerror = () => reject(new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });

export const mergeTemplateProject = ({
  nextProject,
  safeProject,
  applyFirstImageToAllScenes,
}: {
  nextProject: TextMotionProject;
  safeProject: TextMotionProject;
  applyFirstImageToAllScenes?: boolean;
}): TextMotionProject => {
  const firstImageAssetId = safeProject.imageAssets[0]?.id;
  return sanitizeTextMotionProject({
    ...nextProject,
    aspect: safeProject.aspect,
    imageAssets: safeProject.imageAssets,
    scenes: nextProject.scenes.map((scene) => ({
      ...scene,
      imageAssetId:
        applyFirstImageToAllScenes && firstImageAssetId ? firstImageAssetId : scene.imageAssetId,
    })),
  });
};

export const mergeGeneratedProject = ({
  generatedProject,
  safeProject,
  template,
}: {
  generatedProject: TextMotionProject;
  safeProject: TextMotionProject;
  template: TextMotionTemplate;
}): TextMotionProject => {
  const firstImageAssetId = safeProject.imageAssets[0]?.id;
  return sanitizeTextMotionProject({
    ...generatedProject,
    template,
    imageAssets: safeProject.imageAssets,
    scenes: generatedProject.scenes.map((scene) => ({
      ...scene,
      imageAssetId:
        template === "photo-card" && firstImageAssetId ? firstImageAssetId : scene.imageAssetId,
    })),
  });
};

export const createImageAssetsFromFiles = async (
  files: File[],
): Promise<TextMotionImageAsset[]> => {
  const imageAssets: TextMotionImageAsset[] = [];
  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    imageAssets.push({
      id: nanoid(10),
      name: file.name,
      mimeType: file.type || "image/png",
      dataUrl,
    });
  }

  return imageAssets;
};

export const createTextMotionScene = (): TextMotionScene => ({
  id: nanoid(10),
  text: "New motion line",
  durationInFrames: 60,
  animation: "slide-up",
  fontFamily: "sans",
  fontWeight: 700,
  fontStyle: "normal",
  keepOnScreen: false,
});
