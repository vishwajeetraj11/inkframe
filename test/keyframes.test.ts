import {describe, expect, it} from "vitest";
import {evaluateKeyframeChannel, splitClipKeyframes, validateClipKeyframes, type ClipKeyframes} from "@/lib/editor/keyframes";

describe("deterministic clip-local keyframes", () => {
  const channels: ClipKeyframes = {x: [{id: "a", frame: 0, value: 0, interpolation: "linear"}, {id: "b", frame: 30, value: 1, interpolation: "hold"}, {id: "c", frame: 60, value: 2, interpolation: "linear"}]};
  it("holds endpoints and respects exact linear/hold boundaries", () => {
    expect(evaluateKeyframeChannel(channels.x, -1, 9)).toBe(0);
    expect(evaluateKeyframeChannel(channels.x, 15, 9)).toBe(0.5);
    expect(evaluateKeyframeChannel(channels.x, 59, 9)).toBe(1);
    expect(evaluateKeyframeChannel(channels.x, 60, 9)).toBe(2);
    expect(evaluateKeyframeChannel(undefined, 10, 9)).toBe(9);
  });
  it.each([15, 30, 45])("preserves all samples when splitting at %i", split => {
    const [left, right] = splitClipKeyframes(channels, split, 90);
    expect(validateClipKeyframes(left, split)).toEqual([]);
    expect(validateClipKeyframes(right, 90 - split)).toEqual([]);
    for (let frame = 0; frame < 90; frame++) expect(evaluateKeyframeChannel(frame < split ? left.x : right.x, frame < split ? frame : frame - split, 0)).toBeCloseTo(evaluateKeyframeChannel(channels.x, frame, 0), 12);
  });
  it("rejects duplicate frames and invalid values", () => {
    expect(validateClipKeyframes({x: [...channels.x!, {...channels.x![0], id: "d"}]}, 90)).not.toEqual([]);
    expect(validateClipKeyframes({scale: [{id: "s", frame: 0, value: 0, interpolation: "linear"}]}, 90)).not.toEqual([]);
  });
});
