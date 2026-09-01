import type { TextMotionImageAsset, TextMotionScene } from "@/lib/text-motion/types";
import { Plus } from "lucide-react";
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
  const totalFrames = scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0);

  return (
    <section aria-labelledby="storyboard-heading">
      <div className="flex items-end justify-between gap-4 border-y border-[#f2ede3]/15 py-4">
        <div>
          <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-[#ff4f1f]">Sequence</p>
          <h2 id="storyboard-heading" className="app-title mt-1 text-[clamp(1.9rem,4vw,3rem)] font-semibold uppercase leading-none tracking-[-0.02em]">
            Storyboard
          </h2>
          <p className="app-data mt-2 text-[10px] uppercase tracking-[0.12em] text-[#f2ede3]/38">
            {scenes.length} scenes · {(totalFrames / 30).toFixed(1)} seconds · drag-free linear edit
          </p>
        </div>
        <button
          type="button"
          aria-label="Add scene"
          onClick={onAddScene}
          className="flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-2 border border-[#f2ede3]/25 px-3 text-xs font-bold uppercase tracking-[0.08em] text-[#f2ede3] hover:border-[#ff4f1f] hover:bg-[#ff4f1f] hover:text-[#0f0d0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f1f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0d0a] sm:px-4"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          <span className="hidden sm:inline">Add scene</span>
        </button>
      </div>

      <div className="divide-y divide-[#f2ede3]/15 border-b border-[#f2ede3]/15">
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
    </section>
  );
};
