import { describe, expect, it } from "vitest";

import {
  classifyFcpxmlTransition,
  fcpxmlFrameTime,
  serializeFcpxmlAudioAutomation,
  serializeFcpxmlTitleAnimation,
  serializeFcpxmlTimeMap,
  serializeFcpxmlTransformAutomation,
  validateFcpxmlTransitionHandles,
} from "@/lib/export/fcpxml-automation";

describe("FCPXML automation fragments", () => {
  it("serializes normalized transform, opacity, and linear keyframes with FCPXML 1.9 nesting", () => {
    const result = serializeFcpxmlTransformAutomation({
      itemId: "clip",
      fps: 30,
      durationFrames: 60,
      width: 1920,
      height: 1080,
      sourceWidth: 1920,
      sourceHeight: 1080,
      transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, anchor: { x: 0.5, y: 0.5 } },
      keyframes: {
        x: [{ id: "x", frame: 30, value: 0.75, interpolation: "linear" }],
        opacity: [{ id: "o", frame: 30, value: 0.4, interpolation: "linear" }],
      },
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.xml).toContain('<adjust-transform position="0 0" scale="1 1" rotation="0" anchor="0 0">');
    expect(result.xml).toContain('<param name="position"><keyframeAnimation>');
    expect(result.xml).toContain('time="0s" value="44.444444444 0" interp="linear" curve="linear"');
    expect(result.xml).toContain('<adjust-blend amount="0.4" mode="normal"><param name="amount"><keyframeAnimation>');
    expect(result.xml).not.toContain("keyframeAnimation=\"");
  });

  it("does not invent FCPXML holds or non-centred anchors without source geometry", () => {
    const result = serializeFcpxmlTransformAutomation({
      itemId: "clip",
      fps: 30,
      durationFrames: 60,
      width: 1920,
      height: 1080,
      transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, anchor: { x: 0.2, y: 0.5 } },
      keyframes: { opacity: [{ id: "o", frame: 0, value: 0.5, interpolation: "hold" }] },
    });
    expect(result.xml).toContain('<adjust-blend amount="0.5" mode="normal"/>');
    expect(result.diagnostics.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "FCPXML_ANCHOR_OMITTED",
      "FCPXML_OPACITY_HOLD_UNSUPPORTED",
    ]));
  });

  it("converts clockwise canvas rotation and normalized source anchors into FCP units", () => {
    const result = serializeFcpxmlTransformAutomation({
      itemId: "clip",
      fps: 30,
      durationFrames: 30,
      width: 1920,
      height: 1080,
      sourceWidth: 1920,
      sourceHeight: 1080,
      transform: { x: 0.5, y: 0.5, scale: 1, rotation: Math.PI / 2, anchor: { x: 1, y: 0 } },
    });
    expect(result.xml).toContain('rotation="-90" anchor="88.888888889 50"');
  });

  it("serializes constant speeds, holds, and frame-sampled linear speed ramps", () => {
    const constant = serializeFcpxmlTimeMap({
      itemId: "constant",
      fps: 30,
      durationFrames: 60,
      trimStartFrame: 30,
      mapping: { kind: "speed", points: [{ frame: 0, speed: 0.5, interpolation: "linear" }] },
    });
    expect(constant.xml).toContain('<timept time="1s" value="1s" interp="linear"/>');
    expect(constant.xml).toContain('<timept time="3s" value="2s" interp="linear"/>');
    expect(constant.diagnostics).toEqual([]);

    const hold = serializeFcpxmlTimeMap({ itemId: "freeze", fps: 30, durationFrames: 30, trimStartFrame: 0, mapping: { kind: "hold", sourceTimeUs: 1_250_000 } });
    expect(hold.xml).toContain('<timept time="1s" value="5/4s" interp="linear"/>');

    const ramp = serializeFcpxmlTimeMap({
      itemId: "ramp",
      fps: 30,
      durationFrames: 6,
      trimStartFrame: 0,
      mapping: { kind: "speed", points: [{ frame: 0, speed: 0.5, interpolation: "linear" }, { frame: 6, speed: 1, interpolation: "linear" }] },
    });
    expect(ramp.xml?.match(/<timept /g)).toHaveLength(7);
    expect(ramp.diagnostics).toContainEqual(expect.objectContaining({ code: "FCPXML_SPEED_RAMP_SAMPLED" }));
  });

  it("serializes continuous fades and ducking envelopes as dB keyframes", () => {
    const result = serializeFcpxmlAudioAutomation({
      itemId: "music",
      fps: 30,
      durationFrames: 60,
      volume: 1,
      gainEnvelope: [{ frame: 0, value: 1 }, { frame: 15, value: 0.5 }, { frame: 60, value: 1 }],
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.xml).toContain('<adjust-volume amount="0dB"><param name="amount"><keyframeAnimation>');
    expect(result.xml).toContain('time="1/2s" value="-6.020599913dB"');
    const faded = serializeFcpxmlAudioAutomation({ itemId: "faded", fps: 30, durationFrames: 60, volume: 1, fadeInFrames: 15, fadeOutFrames: 15 });
    expect(faded.xml).toContain('<fadeIn type="linear" duration="1/2s"/><fadeOut type="linear" duration="1/2s"/>');
    const trimmed = serializeFcpxmlAudioAutomation({
      itemId: "trimmed",
      fps: 30,
      durationFrames: 30,
      localStartFrame: 300,
      volume: 1,
      gainEnvelope: [{ frame: 0, value: 1 }, { frame: 30, value: 0.5 }],
    });
    expect(trimmed.xml).toContain('keyframe time="10s" value="0dB"');
    expect(trimmed.xml).toContain('keyframe time="11s" value="-6.020599913dB"');
  });

  it("reports audio discontinuities and exact silence instead of manufacturing a dB mapping", () => {
    const jump = serializeFcpxmlAudioAutomation({ itemId: "music", fps: 30, durationFrames: 30, volume: 1, gainEnvelope: [{ frame: 0, value: 1 }, { frame: 10, value: 1 }, { frame: 10, value: 0.5 }] });
    expect(jump.xml).toBeUndefined();
    expect(jump.diagnostics[0]?.code).toBe("FCPXML_AUDIO_JUMP_UNSUPPORTED");
    const silence = serializeFcpxmlAudioAutomation({ itemId: "music", fps: 30, durationFrames: 30, volume: 0 });
    expect(silence.xml).toBeUndefined();
    expect(silence.diagnostics[0]?.code).toBe("FCPXML_SILENCE_UNSUPPORTED");
  });

  it("requires contiguity and verified source handles before calling a dissolve native", () => {
    const transition = { id: "fade", kind: "fade" as const, durationFrames: 12, fromItemId: "a", toItemId: "b" };
    const input = {
      transition,
      fromItem: { id: "a", kind: "video" as const, laneId: "v", name: "a", recordIn: 0, recordOut: 60, sourceIn: 10, sourceOut: 70, assetId: "asset-a" },
      toItem: { id: "b", kind: "video" as const, laneId: "v", name: "b", recordIn: 60, recordOut: 120, sourceIn: 6, sourceOut: 66, assetId: "asset-b" },
      fromAssetDurationFrames: 80,
    };
    expect(validateFcpxmlTransitionHandles(input).canUseNativeTransition).toBe(true);
    expect(classifyFcpxmlTransition(input).capability).toBe("native-cross-dissolve");
    expect(classifyFcpxmlTransition({ ...input, transition: { ...transition, kind: "wipe" } }).capability).toBe("marker-only");
    expect(classifyFcpxmlTransition({ ...input, toItem: { ...input.toItem, sourceIn: 2 } }).capability).toBe("unsupported");
  });

  it("serializes title fade, rise, slide-left, and punch as local intrinsic adjustments", () => {
    const title = (inKind: "fade" | "rise" | "slide-left" | "punch", outKind?: "fade" | "rise" | "slide-left" | "punch") => serializeFcpxmlTitleAnimation({
      fps: 30,
      width: 1920,
      height: 1080,
      overlay: {
        id: `title-${inKind}`,
        startFrame: 30,
        endFrame: 90,
        x: 50,
        y: 50,
        animation: { in: inKind, ...(outKind ? { out: outKind } : {}), durationFrames: 12 },
      },
    });
    const fade = title("fade", "fade");
    expect(fade.xml).toContain('<adjust-blend amount="0" mode="normal"><param name="amount"><keyframeAnimation>');
    expect(fade.xml).not.toContain("<adjust-transform");
    const rise = title("rise");
    expect(rise.xml).toContain('<adjust-transform position="0 0" scale="1 1" rotation="0"><param name="position">');
    expect(rise.xml).toContain('<adjust-blend amount="0" mode="normal">');
    const slide = title("slide-left");
    expect(slide.xml).toContain('<adjust-transform position="0 0" scale="1 1" rotation="0"><param name="position">');
    const punch = title("punch");
    expect(punch.xml).toContain('<param name="scale"><keyframeAnimation>');
    expect(punch.xml).toContain('value="0.76 0.76"');
  });

  it("diagnoses title content reveals without producing a fake motion mapping", () => {
    const result = serializeFcpxmlTitleAnimation({
      fps: 30,
      width: 1920,
      height: 1080,
      overlay: {
        id: "typewriter-title",
        startFrame: 0,
        endFrame: 60,
        x: 50,
        y: 50,
        animation: { in: "typewriter", out: "word-reveal", durationFrames: 12 },
      },
    });
    expect(result.xml).toBeUndefined();
    expect(result.diagnostics.filter((entry) => entry.code === "FCPXML_TITLE_CONTENT_REVEAL_UNSUPPORTED")).toHaveLength(2);
  });

  it("formats reduced FCPXML rational frame time", () => {
    expect(fcpxmlFrameTime(30, 30)).toBe("1s");
    expect(fcpxmlFrameTime(1, 30)).toBe("1/30s");
  });
});
