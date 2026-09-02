import { describe, expect, it } from "vitest";
import type { Project } from "@elah/core";
import { resolveTimeline } from "../node_modules/@elah/core/dist/resolver/resolveTimeline.js";

const projectWithMotion = (
  motion: "fade" | "rise" | "slide-left" | "punch" | "typewriter" | "word-reveal",
): Project => ({
  id: `motion-${motion}`,
  fps: 30,
  stage: { width: 1080, height: 1920 },
  tracks: [
    {
      id: "titles",
      name: "Titles",
      kind: "elements",
      order: 0,
      height: 40,
      locked: false,
      disabled: false,
      muted: false,
      solo: false,
      volume: 1,
    },
  ],
  clips: {
    titles: [
      {
        id: "headline",
        trackId: "titles",
        type: "text",
        name: "Headline",
        startFrame: 0,
        durationFrames: 60,
        sourceStartFrame: 0,
        sourceDurationFrames: 60,
        content: "MAKE GREAT VIDEO",
        opacity: 1,
        transform: {
          x: 0.5,
          y: 0.5,
          scale: 1,
          rotation: 0,
          anchor: { x: 0.5, y: 0.5 },
        },
        textAnimation: { in: motion, durationFrames: 12 },
      },
    ],
  },
  transitions: [],
  version: 1,
});

describe("Elah text motion compatibility layer", () => {
  it("resolves spatial headline motion in the shared preview/export resolver", () => {
    const rise = resolveTimeline(0, projectWithMotion("rise")).texts[0];
    const slide = resolveTimeline(0, projectWithMotion("slide-left")).texts[0];
    const punch = resolveTimeline(0, projectWithMotion("punch")).texts[0];

    expect(rise.opacity).toBe(0);
    expect(rise.transform?.y).toBeGreaterThan(0.5);
    expect(slide.transform?.x).toBeLessThan(0.5);
    expect(punch.transform?.scale).toBeCloseTo(0.76);
  });

  it("resolves paced character and word reveals without changing project data", () => {
    const typewriter = resolveTimeline(3, projectWithMotion("typewriter")).texts[0];
    const words = resolveTimeline(3, projectWithMotion("word-reveal")).texts[0];

    expect(typewriter.content.length).toBeGreaterThan(0);
    expect(typewriter.content.length).toBeLessThan("MAKE GREAT VIDEO".length);
    expect(words.content.split(/\s+/).filter(Boolean).length).toBeGreaterThan(0);
    expect(words.content.split(/\s+/).filter(Boolean).length).toBeLessThan(3);
  });
});

describe("Elah browser audio fade compatibility layer", () => {
  it("resolves fade gain consistently at the start, middle, and end", () => {
    const audioProject: Project = {
      ...projectWithMotion("fade"),
      tracks: [{
        id: "audio",
        name: "Audio",
        kind: "audio",
        order: 0,
        height: 40,
        locked: false,
        disabled: false,
        muted: false,
        solo: false,
        volume: 1,
      }],
      clips: { audio: [{
        id: "soundtrack",
        trackId: "audio",
        type: "audio",
        name: "Soundtrack",
        startFrame: 0,
        durationFrames: 60,
        sourceStartFrame: 0,
        sourceDurationFrames: 60,
        src: "https://example.com/audio.mp3",
        volume: 0.8,
        fadeInFrames: 10,
        fadeOutFrames: 10,
      }] },
    };

    expect(resolveTimeline(0, audioProject).audios[0]?.volume).toBe(0);
    expect(resolveTimeline(10, audioProject).audios[0]?.volume).toBeCloseTo(0.8);
    expect(resolveTimeline(55, audioProject).audios[0]?.volume).toBeCloseTo(0.4);
  });
});
