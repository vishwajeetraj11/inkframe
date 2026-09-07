import { describe, expect, it } from "vitest";
import { framesToTimecode, generateEdl, timecodeToFrames } from "@/lib/export/edl";
import { escapeXml, generateFcpxml } from "@/lib/export/fcpxml";
import { buildInterchangeTimeline } from "@/lib/export/timeline-interchange";
import type { AssetRef, VersionTimeline } from "@/lib/editor/types";

const assets: AssetRef[] = [
  {
    assetId: "video-a",
    kind: "video",
    mimeType: "video/mp4",
    name: 'A&B <take "1">.mp4',
    size: 10,
    externalUrl: "https://example.com/a.mp4?x=1&y=2",
    mediaMetadata: { durationUs: 10_000_000, width: 1920, height: 1080 },
  },
  {
    assetId: "video-b",
    kind: "video",
    mimeType: "video/mp4",
    name: "B.mp4",
    size: 10,
    externalUrl: "https://example.com/b.mp4",
  },
  {
    assetId: "music",
    kind: "audio",
    mimeType: "audio/wav",
    name: "Music.wav",
    size: 10,
  },
];

const version: VersionTimeline = {
  aspect: "widescreen_16_9",
  tracks: [
    { id: "v1", kind: "video", name: "Story", order: 0 },
    { id: "v2", kind: "video", name: "B-roll", order: 1 },
    { id: "titles", kind: "text", name: "Titles", order: 2 },
    { id: "a1", kind: "audio", name: "Music", order: 3 },
  ],
  clips: [
    {
      id: "a",
      assetId: "video-a",
      trackId: "v1",
      kind: "video",
      startFrame: 30,
      endFrame: 60,
      trimStartFrame: 90,
      trimEndFrame: 120,
      volume: 1,
    },
    {
      id: "b",
      assetId: "video-b",
      trackId: "v1",
      kind: "video",
      startFrame: 60,
      endFrame: 120,
      trimStartFrame: 15,
      trimEndFrame: 75,
      volume: 1,
    },
    {
      id: "overlay-video",
      assetId: "video-b",
      trackId: "v2",
      kind: "video",
      startFrame: 45,
      endFrame: 75,
      trimStartFrame: 0,
      trimEndFrame: 30,
      volume: 0,
    },
  ],
  textOverlays: [
    {
      id: "title&1",
      trackId: "titles",
      text: "Fish & Chips <3",
      startFrame: 30,
      endFrame: 90,
      x: 50,
      y: 50,
      fontSize: 40,
      color: "#fff",
      fontFamily: "sans",
      fontWeight: 700,
      fontStyle: "normal",
      stylePreset: "classic",
    },
  ],
  audioTracks: [
    {
      id: "song",
      assetId: "music",
      trackId: "a1",
      startFrame: 0,
      endFrame: 120,
      trimStartFrame: 300,
      trimEndFrame: 420,
      volume: 0.5,
    },
  ],
  transitions: [
    {
      id: "dissolve",
      kind: "fade",
      fromClipId: "a",
      toClipId: "b",
      durationInFrames: 12,
    },
  ],
};

describe("editable timeline export core", () => {
  it("converts non-drop timecode without rounding frames", () => {
    expect(framesToTimecode(110_709, 30)).toBe("01:01:30:09");
    expect(timecodeToFrames("01:01:30:09", 30)).toBe(110_709);
    expect(() => timecodeToFrames("00:00:00:30", 30)).toThrow(RangeError);
  });

  it("preserves explicit placement, trims, lanes, and referenced assets", () => {
    const timeline = buildInterchangeTimeline({ version, assets, name: "Edit One" });
    expect(timeline).toMatchObject({
      name: "Edit One",
      fps: 30,
      width: 1920,
      height: 1080,
      durationFrames: 120,
    });
    expect(timeline.lanes.find((lane) => lane.id === "v1")?.items).toMatchObject([
      { id: "a", recordIn: 30, recordOut: 60, sourceIn: 90, sourceOut: 120 },
      { id: "b", recordIn: 60, recordOut: 120, sourceIn: 15, sourceOut: 75 },
    ]);
    expect(timeline.lanes.find((lane) => lane.id === "v2")?.items[0]?.id).toBe("overlay-video");
    expect(timeline.assets.map((asset) => asset.id)).toEqual(["music", "video-a", "video-b"]);
  });

  it("emits deterministic FCPXML with a timeline gap, connected lanes, assets, and escaped XML", () => {
    const timeline = buildInterchangeTimeline({ version, assets, name: "A&B" });
    const first = generateFcpxml(timeline);
    expect(generateFcpxml(timeline)).toEqual(first);
    expect(first.content).toContain('<fcpxml version="1.9">');
    expect(first.content).toContain('width="1920" height="1080"');
    expect(first.content).toContain('name="A&amp;B &lt;take &quot;1&quot;&gt;.mp4"');
    expect(first.content).toContain("https://example.com/a.mp4?x=1&amp;y=2");
    expect(first.content).toContain('<media-rep kind="original-media"');
    const parsed = new DOMParser().parseFromString(first.content, "application/xml");
    expect([...parsed.querySelectorAll("resources > asset")]
      .every((asset) => !asset.hasAttribute("format"))).toBe(true);
    expect(first.content).toContain('offset="30/30s" start="90/30s" duration="30/30s"');
    expect(first.content).toContain("Fish &amp; Chips &lt;3");
    expect(first.content).toContain('duration="120/30s"');
    expect(
      parsed.querySelector("parsererror"),
    ).toBeNull();
    expect(first.diagnostics.map((diagnostic) => diagnostic.code)).toContain("FCPXML_OFFLINE_ASSET");
    expect(first.diagnostics.map((diagnostic) => diagnostic.code)).toContain("FCPXML_REMOTE_ASSET");
  });

  it("exports CMX cuts, trims, record gaps and a contiguous dissolve with compatibility diagnostics", () => {
    const timeline = buildInterchangeTimeline({ version, assets, name: "Edit One" });
    const result = generateEdl(timeline);
    expect(result.content).toContain("TITLE: Edit One\nFCM: NON-DROP FRAME");
    expect(result.content).toContain("00:00:03:00 00:00:04:06 00:00:01:00 00:00:02:06");
    expect(result.content).toContain("D 012 00:00:00:09 00:00:02:15 00:00:01:24 00:00:04:00");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["EDL_VIDEO_LANES_OMITTED", "EDL_TITLES_OMITTED"]),
    );
  });

  it("reports missing assets and orphaned transitions explicitly", () => {
    const broken = buildInterchangeTimeline({
      version: {
        ...version,
        clips: [{ ...version.clips[0], assetId: "missing" }],
        transitions: [{ ...version.transitions[0], toClipId: "gone" }],
      },
      assets,
    });
    expect(broken.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "error", code: "MISSING_ASSET" }),
        expect.objectContaining({ severity: "error", code: "ORPHANED_TRANSITION" }),
      ]),
    );
  });

  it("never serializes page-scoped Blob URLs", () => {
    const timeline = buildInterchangeTimeline({
      version: { ...version, clips: [version.clips[0]], transitions: [] },
      assets: [{ ...assets[0], externalUrl: "blob:https://inkframe.invalid/session-id" }],
    });
    const result = generateFcpxml(timeline);
    expect(result.content).not.toContain("blob:");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["NON_DURABLE_ASSET_URI", "FCPXML_OFFLINE_ASSET"]),
    );
  });

  it("treats data and relative asset URLs as offline relink placeholders", () => {
    for (const externalUrl of ["data:video/mp4;base64,AAAA", "/private/upload.mp4"]) {
      const timeline = buildInterchangeTimeline({
        version: { ...version, clips: [version.clips[0]], transitions: [] },
        assets: [{ ...assets[0], externalUrl }],
      });
      const result = generateFcpxml(timeline);
      expect(result.content).not.toContain(externalUrl);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: "NON_DURABLE_ASSET_URI" }),
      );
    }
  });

  it("keeps duplicate offline filenames independently relinkable", () => {
    const duplicateAssets = [
      { ...assets[0], assetId: "source-one", name: "take.mp4", externalUrl: undefined },
      { ...assets[1], assetId: "source-two", name: "take.mp4", externalUrl: undefined },
    ];
    const timeline = buildInterchangeTimeline({
      version: {
        ...version,
        clips: [
          { ...version.clips[0], assetId: "source-one" },
          { ...version.clips[1], assetId: "source-two" },
        ],
        audioTracks: [],
        textOverlays: [],
        transitions: [],
      },
      assets: duplicateAssets,
    });
    const content = generateFcpxml(timeline).content;
    expect(content).toContain("source-one-take.mp4");
    expect(content).toContain("source-two-take.mp4");
  });

  it("allocates separate FCP lanes to overlapping connected titles", () => {
    const secondTitle = {
      ...version.textOverlays[0],
      id: "title-two",
      text: "Second title",
      startFrame: 45,
      endFrame: 75,
    };
    const timeline = buildInterchangeTimeline({
      version: { ...version, textOverlays: [...version.textOverlays, secondTitle] },
      assets,
    });
    const content = generateFcpxml(timeline).content;
    const titleLanes = [...content.matchAll(/<title[^>]+lane="(-?\d+)"/g)]
      .map((match) => match[1]);
    expect(new Set(titleLanes).size).toBe(2);
    expect(content).toContain('text-style-def id="ts1"');
    expect(content).toContain('text-style-def id="ts2"');
  });

  it("exports captions as editable ITT caption story elements", () => {
    const captioned = buildInterchangeTimeline({
      version: {
        ...version,
        tracks: [
          ...(version.tracks ?? []),
          { id: "cc", kind: "caption", name: "English", order: 4 },
        ],
        captionCues: [
          {
            id: "cc-1",
            trackId: "cc",
            startFrame: 12,
            endFrame: 42,
            text: "Editable & caption",
          },
        ],
      },
      assets,
    });
    const captionItem = captioned.lanes
      .find((lane) => lane.id === "cc")
      ?.items[0];
    expect(captionItem).toMatchObject({
      id: "cc-1",
      kind: "caption",
      recordIn: 12,
      recordOut: 42,
      text: "Editable & caption",
    });

    const result = generateFcpxml(captioned);
    const document = new DOMParser().parseFromString(result.content, "application/xml");
    const caption = document.querySelector("caption");
    expect(caption?.getAttribute("offset")).toBe("12/30s");
    expect(caption?.getAttribute("duration")).toBe("30/30s");
    expect(caption?.getAttribute("role")).toBe("Inkframe Captions?captionFormat=ITT.en");
    expect(caption?.querySelector("text")?.textContent).toBe("Editable & caption");
    expect(caption?.querySelector("text")?.getAttribute("placement")).toBe("bottom");
    expect(result.diagnostics.map((item) => item.code)).not.toContain("CAPTIONS_OMITTED");
  });

  it("exports static title styling plus clip transform and opacity natively", () => {
    const styled = buildInterchangeTimeline({
      version: {
        ...version,
        clips: [{
          ...version.clips[0],
          transform: {
            x: 0.25,
            y: 0.75,
            scale: 0.5,
            rotation: Math.PI / 2,
            anchor: { x: 0.25, y: 0.75 },
          },
          opacity: 0.4,
        }],
        audioTracks: [],
        textOverlays: [{
          ...version.textOverlays[0],
          x: 25,
          y: 75,
          fontSize: 64,
          color: "#33669980",
          fontFamily: "serif",
          fontWeight: 700,
          fontStyle: "italic",
          textAlign: "left",
          contrast: "outline",
        }],
        transitions: [],
      },
      assets,
    });
    const result = generateFcpxml(styled);
    const document = new DOMParser().parseFromString(result.content, "application/xml");
    const clip = [...document.querySelectorAll("asset-clip")]
      .find((item) => item.getAttribute("offset") === "30/30s");
    const clipTransform = clip?.querySelector("adjust-transform");
    expect(clip?.querySelector("adjust-conform")?.getAttribute("type")).toBe("none");
    expect(clipTransform?.getAttribute("position")).toBe("-44.444444444 -25");
    expect(clipTransform?.getAttribute("scale")).toBe("0.5 0.5");
    expect(clipTransform?.getAttribute("rotation")).toBe("-90");
    expect(clipTransform?.getAttribute("anchor")).toBe("-44.444444444 -25");
    expect(clip?.querySelector("adjust-blend")?.getAttribute("amount")).toBe("0.4");

    const title = document.querySelector("title");
    const titleChildren = [...(title?.children ?? [])].map((child) => child.tagName);
    expect(titleChildren.indexOf("text")).toBeLessThan(titleChildren.indexOf("adjust-transform"));
    expect(titleChildren.indexOf("text-style-def")).toBeLessThan(titleChildren.indexOf("adjust-transform"));
    const textStyle = title?.querySelector("text-style-def > text-style");
    expect(textStyle?.getAttribute("font")).toBe("Georgia");
    expect(textStyle?.getAttribute("fontSize")).toBe("64");
    expect(textStyle?.getAttribute("fontFace")).toBe("Bold Italic");
    expect(textStyle?.getAttribute("fontColor")).toBe("0.2 0.4 0.6 0.501961");
    expect(textStyle?.getAttribute("bold")).toBe("1");
    expect(textStyle?.getAttribute("italic")).toBe("1");
    expect(textStyle?.getAttribute("alignment")).toBe("left");
    expect(textStyle?.getAttribute("strokeColor")).toBe("0.090196 0.070588 0.058824 1");
    expect(title?.querySelector("adjust-transform")?.getAttribute("position"))
      .toBe("-44.444444 -25");
    expect(result.diagnostics.map((item) => item.code)).not.toEqual(
      expect.arrayContaining([
        "CLIP_TRANSFORM_APPROXIMATED",
        "CLIP_OPACITY_APPROXIMATED",
        "TITLE_STYLE_APPROXIMATED",
      ]),
    );
  });

  it("exports clip and track gain, mute, and audio fades as editable adjustments", () => {
    const mixed = buildInterchangeTimeline({
      version: {
        ...version,
        clips: [
          { ...version.clips[0], volume: 0.25 },
          { ...version.clips[2], volume: 0 },
        ],
        textOverlays: [],
        audioTracks: [{
          ...version.audioTracks[0],
          volume: 0.5,
          muted: true,
          fadeInFrames: 10,
          fadeOutFrames: 15,
        }],
        transitions: [],
      },
      assets,
    });
    const result = generateFcpxml(mixed);
    const document = new DOMParser().parseFromString(result.content, "application/xml");
    const clips = [...document.querySelectorAll("asset-clip")];
    const embeddedGain = clips.find((clip) => clip.getAttribute("offset") === "30/30s");
    const embeddedMute = clips.find((clip) => clip.getAttribute("offset") === "45/30s");
    const audio = clips.find((clip) => clip.getAttribute("name") === "Music.wav");

    expect(embeddedGain?.querySelector("adjust-volume")?.getAttribute("amount"))
      .toBe("-12.041199827dB");
    expect(embeddedMute?.getAttribute("srcEnable")).toBe("video");
    expect(audio?.querySelector("adjust-volume")?.getAttribute("amount"))
      .toBe("-6.020599913dB");
    expect(audio?.querySelector("param[name=amount] > fadeIn")?.getAttribute("duration"))
      .toBe("1/3s");
    expect(audio?.querySelector("param[name=amount] > fadeOut")?.getAttribute("duration"))
      .toBe("1/2s");
    expect(audio?.getAttribute("enabled")).toBe("0");
    expect(result.content).not.toContain("audioChannels=");
    expect(result.content).not.toContain("audio-channel-source");
    expect(result.diagnostics.map((item) => item.code)).not.toEqual(
      expect.arrayContaining([
        "EMBEDDED_AUDIO_GAIN_APPROXIMATED",
        "AUDIO_GAIN_APPROXIMATED",
        "AUDIO_FADES_APPROXIMATED",
      ]),
    );
  });

  it("normalizes unequal source and record durations for CMX events", () => {
    const mismatched = buildInterchangeTimeline({
      version: {
        ...version,
        clips: [{ ...version.clips[0], trimStartFrame: 90, trimEndFrame: 180 }],
        audioTracks: [],
        textOverlays: [],
        transitions: [],
      },
      assets,
    });
    const result = generateEdl(mismatched);
    expect(result.content).toContain("00:00:03:00 00:00:04:00");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "EDL_SOURCE_DURATION_NORMALIZED" }),
    );
  });

  it("allocates unique deterministic eight-character CMX reel names", () => {
    const collidingVersion = {
      ...version,
      clips: [
        { ...version.clips[0], assetId: "abcdefgh-one" },
        { ...version.clips[1], assetId: "abcdefgh-two" },
      ],
      audioTracks: [],
      textOverlays: [],
      transitions: [],
    };
    const collidingAssets = collidingVersion.clips.map((clip) => ({
      ...assets[0], assetId: clip.assetId,
    }));
    const content = generateEdl(buildInterchangeTimeline({
      version: collidingVersion,
      assets: collidingAssets,
    })).content;
    expect(content).toContain("ABCDEFGH");
    expect(content).toContain("ABCDEF01");
  });

  it("reports CMX's 999-event compatibility limit", () => {
    const base = version.audioTracks[0];
    const huge = buildInterchangeTimeline({
      version: {
        ...version,
        clips: [],
        textOverlays: [],
        transitions: [],
        audioTracks: Array.from({ length: 1_000 }, (_, index) => ({
          ...base,
          id: `audio-${index}`,
          startFrame: index,
          endFrame: index + 1,
          trimStartFrame: index,
          trimEndFrame: index + 1,
        })),
      },
      assets,
    });
    expect(generateEdl(huge).diagnostics).toContainEqual(
      expect.objectContaining({ severity: "error", code: "EDL_EVENT_LIMIT_EXCEEDED" }),
    );
  });

  it("reports only effects that remain lossy", () => {
    const enriched: VersionTimeline = {
      ...version,
      clips: [{
        ...version.clips[0],
        transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, anchor: { x: 0.5, y: 0.5 } },
        videoFilter: { preset: "warm", brightness: 1, contrast: 1, saturation: 1, sepia: 0, grayscale: 0, hueRotate: 0 },
      }, version.clips[1]],
      transitions: [{ ...version.transitions[0], kind: "wipe" }],
      captionCues: [{ id: "cc1", trackId: "cc", startFrame: 0, endFrame: 10, text: "Hello" }],
      duckingRules: [{
        id: "duck",
        target: { kind: "audio", id: "song" },
        triggers: [{ kind: "video", id: "a" }],
        attenuationDb: -12,
        attackFrames: 3,
        releaseFrames: 3,
      }],
    };
    const codes = buildInterchangeTimeline({ version: enriched, assets }).diagnostics
      .map((diagnostic) => diagnostic.code);
    expect(codes).toEqual(expect.arrayContaining([
      "VIDEO_FILTER_APPROXIMATED",
      "NON_FADE_TRANSITION_APPROXIMATED",
    ]));
    expect(codes).not.toEqual(expect.arrayContaining([
      "CLIP_TRANSFORM_APPROXIMATED",
      "CAPTIONS_OMITTED",
      "AUDIO_DUCKING_OMITTED",
    ]));
  });

  it("projects and serializes keyframes, retiming, title motion, and ducking", () => {
    const automated: VersionTimeline = {
      ...version,
      clips: [{
        ...version.clips[0],
        keyframes: {
          x: [
            { id: "x0", frame: 0, value: 0.5, interpolation: "linear" },
            { id: "x1", frame: 30, value: 0.75, interpolation: "linear" },
          ],
        },
        timeMapping: {
          kind: "speed",
          points: [{ frame: 0, speed: 0.5, interpolation: "linear" }],
        },
      }, ...version.clips.slice(1)],
      textOverlays: [{
        ...version.textOverlays[0],
        animation: { in: "rise", out: "fade", durationFrames: 10 },
      }],
      duckingRules: [{
        id: "duck",
        target: { kind: "audio", id: "song" },
        triggers: [{ kind: "video", id: "b" }],
        attenuationDb: -12,
        attackFrames: 5,
        releaseFrames: 5,
      }],
    };
    const projected = buildInterchangeTimeline({ version: automated, assets });
    expect(projected.lanes.find((lane) => lane.id === "v1")?.items[0]).toMatchObject({
      keyframes: automated.clips[0].keyframes,
      timeMapping: automated.clips[0].timeMapping,
    });
    expect(projected.lanes.find((lane) => lane.id === "a1")?.items[0]?.gainEnvelope)
      .not.toBeUndefined();

    const result = generateFcpxml(projected);
    const document = new DOMParser().parseFromString(result.content, "application/xml");
    expect(document.querySelector("asset-clip timeMap timept")).not.toBeNull();
    const automatedClip = [...document.querySelectorAll("asset-clip")]
      .find((clip) => clip.getAttribute("name")?.startsWith("A&"));
    const automatedClipChildren = [...(automatedClip?.children ?? [])]
      .map((child) => child.tagName);
    expect(automatedClipChildren.indexOf("timeMap"))
      .toBeLessThan(automatedClipChildren.indexOf("adjust-conform"));
    expect(automatedClip?.querySelector("timeMap > timept")?.getAttribute("time"))
      .toBe("3s");
    expect(automatedClip?.querySelector('adjust-transform keyframe[time="3s"]'))
      .not.toBeNull();
    expect(document.querySelector('asset-clip adjust-transform param[name="position"] keyframeAnimation'))
      .not.toBeNull();
    expect(document.querySelector('title adjust-transform param[name="position"] keyframeAnimation'))
      .not.toBeNull();
    expect(document.querySelector('asset-clip[name="Music.wav"] adjust-volume param[name="amount"] keyframeAnimation'))
      .not.toBeNull();
    expect(document.querySelector('asset-clip[name="Music.wav"] adjust-volume keyframe')?.getAttribute("time"))
      .toBe("10s");
    expect(result.diagnostics.map((item) => item.code)).not.toEqual(expect.arrayContaining([
      "CLIP_KEYFRAMES_APPROXIMATED",
      "TIME_MAPPING_APPROXIMATED",
      "TITLE_ANIMATION_OMITTED",
      "AUDIO_DUCKING_OMITTED",
    ]));
  });

  it("emits a native cross dissolve for a validated simple primary storyline", () => {
    const simple: VersionTimeline = {
      ...version,
      tracks: [{ id: "v1", kind: "video", name: "Story", order: 0 }],
      clips: version.clips.slice(0, 2),
      textOverlays: [],
      audioTracks: [],
    };
    const result = generateFcpxml(buildInterchangeTimeline({ version: simple, assets }));
    const document = new DOMParser().parseFromString(result.content, "application/xml");
    const transition = document.querySelector("spine > transition");
    expect(transition?.getAttribute("name")).toBe("Cross Dissolve");
    expect(transition?.getAttribute("offset")).toBe("54/30s");
    expect(transition?.getAttribute("duration")).toBe("12/30s");
    expect(transition?.querySelector("filter-video")?.getAttribute("ref")).toBeTruthy();
    expect(document.querySelector("marker")).toBeNull();
    expect([...document.querySelectorAll("spine > asset-clip")]
      .every((clip) => !clip.hasAttribute("lane"))).toBe(true);
    expect(result.diagnostics.map((item) => item.code))
      .not.toContain("FCPXML_CONNECTED_TRANSITION_NOTE");
  });
});

describe("XML escaping", () => {
  it("escapes all five XML special characters", () => {
    expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;");
  });

  it("replaces characters forbidden by XML 1.0", () => {
    expect(escapeXml("before\u0001after")).toBe("before�after");
  });
});
