import { describe, expect, it } from "vitest";
import { planAudioBalance, type AudioBalanceInput } from "@/lib/editor/audio-balance";
import { evaluateGainEnvelope } from "@/lib/editor/deterministic-runtime.mjs";
import type { VersionTimeline } from "@/lib/editor/types";

const fixture = (): VersionTimeline => ({ aspect: "widescreen_16_9", clips: [], textOverlays: [], transitions: [], audioTracks: [
  { id: "music", assetId: "music", startFrame: 10, endFrame: 100, trimStartFrame: 0, trimEndFrame: 90, volume: 1 },
  { id: "voice", assetId: "voice", startFrame: 30, endFrame: 50, trimStartFrame: 0, trimEndFrame: 20, volume: 1 },
] });
const input = (): AudioBalanceInput => ({ music: { kind: "audio", id: "music" }, narration: [{ kind: "audio", id: "voice" }], strength: "balanced", ruleId: "balance" });

describe("audio balance planning", () => {
  it.each([["gentle", -6], ["balanced", -12], ["strong", -18]] as const)("plans %s ducking with target-local ramps without mutation", (strength, db) => {
    const version = fixture(), before = structuredClone(version), request = { ...input(), strength };
    const result = planAudioBalance(version, request);
    expect(result.rule).toMatchObject({ attenuationDb: db, attackFrames: 6, releaseFrames: 15 });
    expect(evaluateGainEnvelope(result.envelope, 14)).toBe(1);
    expect(evaluateGainEnvelope(result.envelope, 20)).toBeCloseTo(10 ** (db / 20));
    expect(evaluateGainEnvelope(result.envelope, 55)).toBe(1);
    expect(result.warnings.join(" ")).toContain("no speech detection");
    expect(version).toEqual(before);
    result.rule.triggers[0].id = "changed";
    expect(request.narration[0].id).toBe("voice");
  });
  it("includes stronger existing rules instead of replacing them", () => {
    const version = fixture();
    version.duckingRules = [{ id: "existing", target: input().music, triggers: input().narration, attenuationDb: -24, attackFrames: 6, releaseFrames: 15 }];
    const result = planAudioBalance(version, input());
    expect(evaluateGainEnvelope(result.envelope, 25)).toBeCloseTo(10 ** (-24 / 20));
    expect(result.warnings.join(" ")).toContain("strongest attenuation wins");
    expect(version.duckingRules).toHaveLength(1);
  });
  it("rejects missing, empty, self, duplicate, and nonoverlapping narration", () => {
    for (const narration of [[], [{ kind: "audio", id: "missing" }], [input().music], [...input().narration, ...input().narration]] as AudioBalanceInput["narration"][])
      expect(() => planAudioBalance(fixture(), { ...input(), narration })).toThrow();
    const version = fixture(); version.audioTracks[1].startFrame = 100; version.audioTracks[1].endFrame = 120;
    expect(() => planAudioBalance(version, input())).toThrow(/does not overlap/);
  });
  it("rejects muted or zero-volume sources and colliding IDs", () => {
    const version = fixture(); version.audioTracks[1].muted = true;
    expect(() => planAudioBalance(version, input())).toThrow(/not audible/);
    version.audioTracks[1].muted = false; version.audioTracks[1].volume = 0;
    expect(() => planAudioBalance(version, input())).toThrow(/not audible/);
    expect(() => planAudioBalance(fixture(), { ...input(), ruleId: "music" })).toThrow(/already exists/);
    expect(() => planAudioBalance(fixture(), { ...input(), ruleId: " " })).toThrow(/nonempty/);
  });
  it("supports embedded video narration but rejects silent retiming and image refs", () => {
    const version = fixture();
    version.clips = [{ ...version.audioTracks[1], id: "video", kind: "video" }];
    const request: AudioBalanceInput = { ...input(), narration: [{ kind: "video", id: "video" }] };
    expect(planAudioBalance(version, request).rule.triggers).toEqual(request.narration);
    version.clips[0].timeMapping = { kind: "hold", sourceTimeUs: 0 };
    expect(() => planAudioBalance(version, request)).toThrow(/not audible/);
    delete version.clips[0].timeMapping; version.clips[0].kind = "image";
    expect(() => planAudioBalance(version, request)).toThrow(/does not exist/);
  });
});
