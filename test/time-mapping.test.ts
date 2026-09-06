import {describe, expect, it} from "vitest";
import {sourceTimeAtFrame, splitTimeMapping, validateTimeMapping, type TimeMapping} from "@/lib/editor/time-mapping";

describe("deterministic source-time mapping", () => {
  const ramp: TimeMapping = {kind: "speed", points: [{frame: 0, speed: 1, interpolation: "linear"}, {frame: 30, speed: 3, interpolation: "hold"}, {frame: 60, speed: 0.5, interpolation: "linear"}]};
  it("integrates speed instead of multiplying by instantaneous speed", () => {
    expect(sourceTimeAtFrame(ramp, 30, 0)).toBeCloseTo(2e6);
    expect(sourceTimeAtFrame(ramp, 60, 0)).toBeCloseTo(5e6);
    expect(sourceTimeAtFrame({kind: "speed", points: [{frame: 0, speed: 2, interpolation: "linear"}]}, 30, 0)).toBeCloseTo(2e6);
    expect(sourceTimeAtFrame({kind: "hold", sourceTimeUs: 123456}, 200, 0)).toBe(123456);
  });
  it.each([15, 30, 45, 70])("preserves samples and fractional offsets after split at %i", split => {
    const [left, right] = splitTimeMapping(ramp, split, 90, 7);
    for (let frame = 0; frame < 90; frame++) expect(sourceTimeAtFrame(frame < split ? left : right, frame < split ? frame : frame - split, 0)).toBeCloseTo(sourceTimeAtFrame(ramp, frame, 7), 6);
  });
  it("splits normal playback without losing its source offset", () => {
    const [left, right] = splitTimeMapping(undefined, 15, 60, 9);
    expect(sourceTimeAtFrame(left, 14, 0)).toBeCloseTo(23 / 30 * 1e6);
    expect(sourceTimeAtFrame(right, 0, 0)).toBeCloseTo(24 / 30 * 1e6);
  });
  it("rejects invalid speed, duplicate points and source overflow", () => {
    expect(validateTimeMapping(ramp, 90, 0, 4e6)).not.toEqual([]);
    expect(validateTimeMapping({kind: "hold", sourceTimeUs: 4e6}, 30, 0, 4e6)).not.toEqual([]);
    expect(validateTimeMapping({kind: "speed", points: [{frame: 0, speed: -1, interpolation: "hold"}]}, 30, 0)).not.toEqual([]);
  });
});
