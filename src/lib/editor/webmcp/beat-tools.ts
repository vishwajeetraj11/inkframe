import { z } from "zod";
import { getWebMCPExecuteSignal, type WebMcpTool } from "@/lib/webmcp/types";
import { FPS } from "../constants";
import { planBeatMontage } from "../beat-montage";
import type { VersionTimeline, AssetRef, AspectPreset } from "../types";
import type { EditorAction } from "../reducer";
import type { EditorWebMcpToolContext } from "./tools";

const id = z.string().trim().min(1).max(128);
const aspect = z.enum(["reel_9_16", "widescreen_16_9"]);
const planInput = z.object({
  aspect,
  videos: z.array(z.object({ assetId: id, preferredStartSeconds: z.number().min(0).max(86400).optional() }).strict()).min(1).max(30),
  audioAssetId: id,
  durationSeconds: z.number().min(1).max(60),
  musicStartSeconds: z.number().min(0).max(86400).default(0),
  minShotSeconds: z.number().min(0.5).max(10).default(1.5),
  maxShotSeconds: z.number().min(0.5).max(20).default(4),
  preserveText: z.boolean().default(true),
}).strict();
const applyInput = z.object({ aspect, planId: id, expectedRevision: z.number().int().nonnegative(), operationId: id, confirmed: z.literal(true) }).strict();
type CommandInput = { aspect: AspectPreset; expectedRevision: number; operationId: string };
type Command = (input: CommandInput, action: () => EditorAction) => string;

function tool<T extends z.ZodType>(name: string, description: string, schema: T, readOnly: boolean,
  execute: (input: z.infer<T>, signal: AbortSignal) => unknown | Promise<unknown>): WebMcpTool {
  return { name, description, inputSchema: z.toJSONSchema(schema), annotations: { readOnlyHint: readOnly, untrustedContentHint: readOnly },
    execute: async (input, options) => {
      const signal = getWebMCPExecuteSignal(options);
      signal.throwIfAborted();
      const result = await execute(schema.parse(input), signal);
      signal.throwIfAborted();
      return typeof result === "string" ? result : JSON.stringify(result);
    },
  };
}

/** Plans live with the registered tools; no project mutation until apply. */
export function createBeatMontageTools(context: EditorWebMcpToolContext, command: Command): WebMcpTool[] {
  const plans = new Map<string, { revision: number; expires: number; version: VersionTimeline; assets: string }>();
  let sequence = 0;
  const assetsFingerprint = () => JSON.stringify(context.getAssets?.() ?? []);
  const requireAsset = (assetId: string, kind: AssetRef["kind"]) => {
    const asset = context.getAssets?.().find((item) => item.assetId === assetId && item.kind === kind);
    if (!asset || !asset.mediaMetadata || !Number.isFinite(asset.mediaMetadata.durationUs) || asset.mediaMetadata.durationUs <= 0) {
      throw new Error(`Upload a ${kind} with known duration for asset ${assetId}`);
    }
    return asset;
  };
  return [
    tool("editor_inspect_video_moments", "Inspect six timestamped source frames from an uploaded video. Visually review the contact sheet to choose preferredStartSeconds for editor_plan_beat_montage. Brightness and sharpness are cues, not semantic quality judgments. Repeat for each supplied video; sampling cannot guarantee finding every action peak.",
      z.object({ assetId: id }).strict(), true, async (input, signal) => {
        const asset = requireAsset(input.assetId, "video");
        if (!context.sampleVideoMoments) throw new Error("Video sampling unavailable");
        return { ok: true, assetId: asset.assetId, ...await context.sampleVideoMoments(asset.assetId, asset.mediaMetadata!.durationUs / 1e6, signal) };
      }),
    tool("editor_plan_beat_montage", "Plan an edit from 1–30 uploaded videos and one music track, up to 60 seconds. First inspect each video's moments and choose preferredStartSeconds and video order based on the images and user brief. Detects musical onsets, proposes beat-aligned cuts, and returns source trims without changing the timeline. Videos cycle in supplied order when needed. Existing audio/transitions/captions are replaced; text is optionally retained within the new duration. Show the plan and warnings before applying. This is a timing preview, not a rendered video preview.",
      planInput, true, async (input, signal) => {
        if (context.getState().present.activeCutdownId) throw new Error("Select an aspect master before planning a beat montage");
        if (input.minShotSeconds > input.maxShotSeconds) throw new Error("minShotSeconds must not exceed maxShotSeconds");
        const state = context.getState();
        const revision = state.revision ?? 0;
        const fingerprint = assetsFingerprint();
        const audio = requireAsset(input.audioAssetId, "audio");
        const musicStartFrame = Math.round(input.musicStartSeconds * FPS);
        const durationFrames = Math.round(input.durationSeconds * FPS);
        if (musicStartFrame + durationFrames > Math.floor(audio.mediaMetadata!.durationUs * FPS / 1e6)) throw new Error("Music is too short for this start and duration");
        const videos = input.videos.map((video) => ({ ...video, durationSeconds: requireAsset(video.assetId, "video").mediaMetadata!.durationUs / 1e6 }));
        if (!context.analyzeMusic) throw new Error("Music analysis unavailable");
        const analysis = await context.analyzeMusic(audio.assetId, { startSeconds: musicStartFrame / FPS, durationSeconds: durationFrames / FPS }, signal);
        signal.throwIfAborted();
        if (!Number.isFinite(analysis.durationSeconds) || analysis.durationSeconds + 0.0001 < durationFrames / FPS) throw new Error("Decoded music is too short for this duration; shorten the edit or choose another track");
        if ((context.getState().revision ?? 0) !== revision || assetsFingerprint() !== fingerprint) throw new Error("Project or media changed during analysis; plan again");
        const plan = planBeatMontage({ videos, durationSeconds: durationFrames / FPS, beatTimesSeconds: analysis.beatTimesSeconds, minShotSeconds: input.minShotSeconds, maxShotSeconds: input.maxShotSeconds });
        const planId = `beat-${Date.now().toString(36)}-${++sequence}`;
        const current = state.present.versions[input.aspect];
        const version: VersionTimeline = {
          aspect: input.aspect,
          tracks: current.tracks?.map((track) => ({ ...track })),
          clips: plan.shots.map((shot, index) => ({ ...shot, id: `${planId}-v${index}`, kind: "video", volume: 0, sourceDurationUs: requireAsset(shot.assetId, "video").mediaMetadata!.durationUs })),
          audioTracks: [{ id: `${planId}-music`, assetId: audio.assetId, startFrame: 0, endFrame: plan.durationFrames, trimStartFrame: musicStartFrame, trimEndFrame: musicStartFrame + plan.durationFrames, volume: 1 }],
          textOverlays: input.preserveText ? current.textOverlays.filter((text) => text.startFrame < plan.durationFrames).map((text) => ({ ...text, endFrame: Math.min(text.endFrame, plan.durationFrames) })) : [],
          transitions: [], captionCues: [], duckingRules: [],
        };
        for (const [key, value] of plans) if (value.expires <= Date.now()) plans.delete(key);
        if (plans.size >= 12) plans.delete(plans.keys().next().value!);
        plans.set(planId, { revision, expires: Date.now() + 30 * 60_000, version, assets: fingerprint });
        return { ok: true, planId, revision, aspect: input.aspect, ...plan, analysis,
          warnings: [...analysis.warnings, ...plan.warnings, "Applying replaces this aspect's clips, music, transitions and captions; source video audio is muted.", ...(input.preserveText ? ["Existing text timing is retained and clipped to the new duration; review its placement against the new footage."] : [])],
          nextAction: "Review source trims and cut timing, then editor_apply_beat_montage with planId, aspect, expectedRevision and a unique operationId. Play the timeline after applying; editor_undo restores it in one step." };
      }),
    tool("editor_apply_beat_montage", "Apply the exact reviewed beat montage in one undoable, retry-safe command. Requires its planId and revision. Replaces the selected aspect master. Play the timeline to review the result; undo to restore the previous edit.",
      applyInput, false, (input) => command(input, () => {
        const plan = plans.get(input.planId);
        if (!plan || plan.expires <= Date.now()) throw new Error("PLAN_EXPIRED: Plan again before applying");
        if (context.getState().present.activeCutdownId) throw new Error("Select an aspect master before applying a beat montage");
        if (plan.revision !== input.expectedRevision || plan.version.aspect !== input.aspect || plan.assets !== assetsFingerprint()) throw new Error("STALE_PLAN: Project or assets changed; plan again");
        return { type: "replace-version", aspect: input.aspect, version: plan.version };
      })),
  ];
}
