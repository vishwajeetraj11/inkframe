import { describe, expect, it } from "vitest";
import { createDefaultClip, createInitialProjectSession } from "@/lib/editor/defaults";
import { fromElahProject, toElahProject } from "@/lib/editor/elah-adapter";
import { editorHistoryReducer, validateEditorCommandAction, type EditorHistoryState } from "@/lib/editor/history";
import { migrateProjectContent } from "@/lib/editor/project-migrations";
import { editorReducer, type EditorAction } from "@/lib/editor/reducer";
import type { VideoFilter } from "@/lib/editor/types";

const aspect = "reel_9_16" as const;
const legacy: VideoFilter = {
  preset: "custom", brightness: 1, contrast: 1, saturation: 1,
  sepia: 0, grayscale: 0, hueRotate: 0,
};
const grade = {
  ...legacy, exposure: 1.25, temperature: -0.3, tint: 0.2,
  shadows: 0.4, highlights: -0.6, toneCurve: "filmic" as const,
};
const sessionWith = (filter: VideoFilter = grade) => {
  const session = createInitialProjectSession();
  session.versions[aspect].clips = [{ ...createDefaultClip("shot", "asset", "video"), videoFilter: structuredClone(filter) }];
  return session;
};
const update = (filter: VideoFilter): EditorAction => ({
  type: "update-clip", aspect, clipId: "shot", patch: { videoFilter: filter },
});
const projectWith = (filter: VideoFilter = grade) => toElahProject(sessionWith(filter).versions[aspect], {
  assetSources: { asset: "blob:shot-grade" },
});
const nativeShot = (projection: ReturnType<typeof toElahProject>) =>
  Object.values(projection.project.clips).flat().find(clip => clip.id === "shot")!;

describe("shot grade round trips", () => {
  it("survives JSON serialization and the persisted-project migration", () => {
    const restored = migrateProjectContent(JSON.parse(JSON.stringify(sessionWith())));
    expect(restored.versions[aspect].clips[0].videoFilter).toEqual(grade);
  });

  it("projects all grades and restores a serialized Elah project plus sidecar", () => {
    const projection = projectWith();
    expect(nativeShot(projection).videoFilter).toEqual(grade);
    const serialized = JSON.parse(JSON.stringify(projection));
    expect(fromElahProject(serialized.project, serialized.sidecar).version.clips[0].videoFilter).toEqual(grade);
  });

  it("preserves sidecar grades when Elah returns only legacy filter fields", () => {
    const projection = projectWith();
    nativeShot(projection).videoFilter = { ...legacy, contrast: 1.2 };
    expect(fromElahProject(projection.project, projection.sidecar).version.clips[0].videoFilter)
      .toEqual({ ...grade, contrast: 1.2 });
  });

  it("uses explicit native neutral grades and linear tone curve", () => {
    const projection = projectWith();
    const neutral = { ...legacy, exposure: 0, temperature: 0, tint: 0, shadows: 0, highlights: 0, toneCurve: "linear" as const };
    nativeShot(projection).videoFilter = neutral;
    expect(fromElahProject(projection.project, projection.sidecar).version.clips[0].videoFilter).toEqual(neutral);
  });

  it("recovers grades if Elah omits the filter entirely", () => {
    const projection = projectWith();
    delete nativeShot(projection).videoFilter;
    expect(fromElahProject(projection.project, projection.sidecar).version.clips[0].videoFilter).toEqual(grade);
  });

  it("imports grades on a native clip without a canonical counterpart", () => {
    const projection = projectWith();
    nativeShot(projection).id = "native-shot";
    projection.sidecar.canonicalVersion.clips = [];
    expect(fromElahProject(projection.project, projection.sidecar).version.clips[0].videoFilter).toEqual(grade);
  });

  it("isolates the sidecar filter from source and projected mutations", () => {
    const session = sessionWith();
    const projection = toElahProject(session.versions[aspect], { assetSources: { asset: "blob:shot" } });
    Object.assign(session.versions[aspect].clips[0].videoFilter!, { exposure: -2 });
    Object.assign(nativeShot(projection).videoFilter!, { exposure: 2 });
    expect(projection.sidecar.canonicalVersion.clips[0].videoFilter).toEqual(grade);
  });

  it("retains grades for unresolved assets through serialized sidecar recovery", () => {
    const projection = JSON.parse(JSON.stringify(toElahProject(sessionWith().versions[aspect])));
    expect(fromElahProject(projection.project, projection.sidecar).version.clips[0].videoFilter).toEqual(grade);
  });

  it("keeps legacy optional fields absent through migration and projection", () => {
    const restored = migrateProjectContent(JSON.parse(JSON.stringify(sessionWith(legacy))));
    const projection = toElahProject(restored.versions[aspect], { assetSources: { asset: "blob:shot" } });
    expect(fromElahProject(projection.project, projection.sidecar).version.clips[0].videoFilter).toEqual(legacy);
  });

  it("preserves grades through command application, undo, and redo", () => {
    const initial: EditorHistoryState = { past: [], present: sessionWith(legacy), future: [], revision: 0 };
    const applied = editorHistoryReducer(initial, {
      type: "history/command", operationId: "grade-shot", expectedRevision: 0, actions: [update(grade)],
    });
    expect(applied.lastCommandReceipt?.ok).toBe(true);
    expect(applied.present.versions[aspect].clips[0].videoFilter).toEqual(grade);
    const undone = editorHistoryReducer(applied, { type: "history/undo" });
    expect(undone.present.versions[aspect].clips[0].videoFilter).toEqual(legacy);
    const redone = editorHistoryReducer(undone, { type: "history/redo" });
    expect(redone.present.versions[aspect].clips[0].videoFilter).toEqual(grade);
  });

  it.each([-1, 1])("accepts inclusive grade bounds with sign %s", sign => {
    const filter = { ...grade, exposure: sign * 2, temperature: sign, tint: sign, shadows: sign, highlights: sign };
    const session = sessionWith(legacy);
    expect(validateEditorCommandAction(session, update(filter))).toEqual([]);
    expect(editorReducer(session, update(filter)).versions[aspect].clips[0].videoFilter).toEqual(filter);
  });

  const invalid: [string, unknown][] = [
    ...["exposure", "temperature", "tint", "shadows", "highlights"].flatMap(field => {
      const limit = field === "exposure" ? 2 : 1;
      return [limit + 0.01, -limit - 0.01, NaN, Infinity, -Infinity, "0", null]
        .map(value => [field, value] as [string, unknown]);
    }),
    ["toneCurve", "log"], ["toneCurve", null], ["toneCurve", 0],
  ];
  it.each(invalid)("rejects invalid %s=%s without creating an undo step", (field, value) => {
    const session = sessionWith(legacy);
    const action = update({ ...grade, [field]: value } as VideoFilter);
    expect(validateEditorCommandAction(session, action)[0]?.code).toBe("INVALID_VALUE");
    expect(editorReducer(session, action)).toBe(session);
    const result = editorHistoryReducer({ past: [], present: session, future: [], revision: 0 }, {
      type: "history/command", operationId: "invalid-grade", expectedRevision: 0, actions: [action],
    });
    expect(result.lastCommandReceipt).toMatchObject({ ok: false, code: "INVALID_VALUE" });
    expect(result.present).toBe(session);
    expect(result.past).toEqual([]);
  });
});
