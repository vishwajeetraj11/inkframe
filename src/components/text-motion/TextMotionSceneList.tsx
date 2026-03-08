import type { TextMotionImageAsset, TextMotionScene } from "@/lib/text-motion/types";
import { TextMotionSceneCard } from "./TextMotionSceneCard";

interface TextMotionSceneListProps {
  imageAssets: TextMotionImageAsset[];
  imagePreviewById: Map<string, string>;
  onAddScene: () => void;
  onChangeScene: (sceneId: string, patch: Partial<TextMotionScene>) => void;
  onDeleteScene: (sceneId: string) => void;
  scenes: TextMotionScene[];
}

export const TextMotionSceneList = ({
  imageAssets,
  imagePreviewById,
  onAddScene,
  onChangeScene,
  onDeleteScene,
  scenes,
}: TextMotionSceneListProps) => {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4">
      <div className="flex items-center justify-between">
        <h2 className="app-panel-label text-sm font-semibold uppercase tracking-wide text-slate-300">
          Scenes
        </h2>
        <button
          type="button"
          onClick={onAddScene}
          className="rounded-md border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-200"
        >
          Add Scene
        </button>
      </div>

      <div className="max-h-[30rem] space-y-3 overflow-y-auto pr-1">
        {scenes.map((scene, index) => (
          <TextMotionSceneCard
            key={scene.id}
            scene={scene}
            index={index}
            imageAssets={imageAssets}
            imagePreviewUrl={scene.imageAssetId ? imagePreviewById.get(scene.imageAssetId) : undefined}
            onChange={(patch) => onChangeScene(scene.id, patch)}
            onDelete={() => onDeleteScene(scene.id)}
          />
        ))}
      </div>
    </div>
  );
};
