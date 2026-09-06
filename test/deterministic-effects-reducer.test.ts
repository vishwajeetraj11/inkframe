import {describe, expect, it} from "vitest";
import {editorReducer, type EditorAction} from "@/lib/editor/reducer";
import {sourceTimeAtFrame} from "@/lib/editor/time-mapping";
import {evaluateKeyframeChannel} from "@/lib/editor/keyframes";
import type {ProjectSession, VersionTimeline} from "@/lib/editor/types";
const version = (): VersionTimeline => ({aspect: "reel_9_16", tracks: [{id: "captions", kind: "caption", name: "Captions", order: 3}], clips: [{id: "video", kind: "video", assetId: "source", startFrame: 0, endFrame: 90, trimStartFrame: 12, trimEndFrame: 102, volume: 1, keyframes: {x: [{id: "x0", frame: 0, value: 0, interpolation: "linear"}, {id: "x1", frame: 90, value: 1, interpolation: "linear"}]}}], audioTracks: [{id: "music", assetId: "audio", startFrame: 0, endFrame: 90, trimStartFrame: 0, trimEndFrame: 90, volume: 1}], textOverlays: [], transitions: []});
const state = (): ProjectSession => ({activeVersion: "reel_9_16", versions: {reel_9_16: version(), widescreen_16_9: {...version(), aspect: "widescreen_16_9"}}});
const ducked = (): ProjectSession => {const s = state(); s.versions.reel_9_16.duckingRules = [{id: "duck", target: {kind: "audio", id: "music"}, triggers: [{kind: "video", id: "video"}], attenuationDb: -12, attackFrames: 3, releaseFrames: 3}]; return s;};

describe("effect reducer atomicity and structural edits", () => {
  it("freezes only the chosen interval and preserves outside animation/source audio mapping", () => {
    const initial = ducked();
    const next = editorReducer(initial, {type: "freeze-clip-range", aspect: "reel_9_16", clipId: "video", startFrame: 30, endFrame: 60, sourceTimeUs: 2e6, segmentIds: ["left", "held", "right"]});
    expect(next).not.toBe(initial);
    const clips = next.versions.reel_9_16.clips;
    expect(clips.map(clip => [clip.startFrame, clip.endFrame])).toEqual([[0,30],[30,60],[60,90]]);
    expect(clips[0].timeMapping).toBeUndefined();
    expect(clips[2].timeMapping).toBeUndefined();
    expect(next.versions.reel_9_16.duckingRules?.[0].triggers).toEqual([{kind: "video", id: "left"}, {kind: "video", id: "right"}]);
    for(let frame=0;frame<90;frame++) {
      const clip=clips.find(item => item.startFrame<=frame && item.endFrame>frame)!;
      expect(sourceTimeAtFrame(clip.timeMapping,frame-clip.startFrame,clip.trimStartFrame)).toBeCloseTo(frame>=30 && frame<60 ? 2e6 : (12+frame)/30*1e6,6);
      expect(evaluateKeyframeChannel(clip.keyframes?.x,frame-clip.startFrame)).toBeCloseTo(frame/90,12);
    }
  });
  it("splits retimed animation without losing integrated source offsets", () => {
    const initial = state(); initial.versions.reel_9_16.clips[0].timeMapping={kind:"speed",points:[{frame:0,speed:0.5,interpolation:"linear"},{frame:90,speed:1,interpolation:"linear"}]};
    const next=editorReducer(initial,{type:"split-clip",aspect:"reel_9_16",clipId:"video",splitFrame:33,leftClipId:"left",rightClipId:"right"});
    expect(next).not.toBe(initial);
    for(let frame=0;frame<90;frame++) {
      const clip=next.versions.reel_9_16.clips[frame<33?0:1];
      expect(sourceTimeAtFrame(clip.timeMapping,frame-clip.startFrame,clip.trimStartFrame)).toBeCloseTo(sourceTimeAtFrame(initial.versions.reel_9_16.clips[0].timeMapping,frame,12),6);
    }
  });
  it("removes dangling duck rules on source deletion and remaps triggers on normal split", () => {
    const initial=ducked();
    expect(editorReducer(initial,{type:"remove-clip",aspect:"reel_9_16",clipId:"video"}).versions.reel_9_16.duckingRules).toEqual([]);
    expect(editorReducer(initial,{type:"remove-audio-track",aspect:"reel_9_16",trackId:"music"}).versions.reel_9_16.duckingRules).toEqual([]);
    expect(editorReducer(initial,{type:"split-clip",aspect:"reel_9_16",clipId:"video",splitFrame:30,leftClipId:"left",rightClipId:"right"}).versions.reel_9_16.duckingRules?.[0].triggers).toHaveLength(2);
  });
  it("rejects whole invalid cue batch, excessive source mapping and absent operations preserve identity", () => {
    const initial=state();
    const actions: EditorAction[] = [
      {type:"remove-caption-cue",aspect:"reel_9_16",cueId:"missing"},
      {type:"remove-ducking-rule",aspect:"reel_9_16",ruleId:"missing"},
      {type:"upsert-caption-cues",aspect:"reel_9_16",cues:[]},
      {type:"set-clip-time-mapping",aspect:"reel_9_16",clipId:"video",mapping:{kind:"hold",sourceTimeUs:4e6}},
      {type:"upsert-caption-cues",aspect:"reel_9_16",cues:[{id:"one",trackId:"captions",text:"One",startFrame:0,endFrame:30},{id:"two",trackId:"captions",text:"Two",startFrame:20,endFrame:40}]},
    ];
    for(const action of actions) expect(editorReducer(initial,action)).toBe(initial);
  });
  it("restores normal playback at the actual mapped source start and rejects fractional offsets", () => {
    const initial=state();
    initial.versions.reel_9_16.clips[0].sourceDurationUs=6e6;
    initial.versions.reel_9_16.clips[0].timeMapping={kind:"speed",sourceStartTimeUs:1e6,points:[{frame:0,speed:0.5,interpolation:"linear"}]};
    const normal=editorReducer(initial,{type:"set-clip-time-mapping",aspect:"reel_9_16",clipId:"video",mapping:{kind:"normal"}});
    expect(normal.versions.reel_9_16.clips[0]).toMatchObject({trimStartFrame:30,trimEndFrame:120,timeMapping:{kind:"normal"}});
    initial.versions.reel_9_16.clips[0].timeMapping={kind:"speed",sourceStartTimeUs:1e6+1,points:[{frame:0,speed:0.5,interpolation:"linear"}]};
    expect(editorReducer(initial,{type:"set-clip-time-mapping",aspect:"reel_9_16",clipId:"video",mapping:{kind:"normal"}})).toBe(initial);
  });
});
