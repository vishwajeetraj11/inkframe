import type {
  ExportDiagnostic,
  InterchangeItem,
  InterchangeTimeline,
} from "./timeline-interchange";

export interface EdlExportResult {
  content: string;
  diagnostics: ExportDiagnostic[];
}

export const framesToTimecode = (frames: number, fps: number): string => {
  if (!Number.isInteger(frames) || frames < 0 || !Number.isInteger(fps) || fps <= 0) {
    throw new RangeError("Frames and fps must be non-negative integers and fps must be positive.");
  }
  const frame = frames % fps;
  const secondsTotal = Math.floor(frames / fps);
  const seconds = secondsTotal % 60;
  const minutesTotal = Math.floor(secondsTotal / 60);
  const minutes = minutesTotal % 60;
  const hours = Math.floor(minutesTotal / 60);
  return [hours, minutes, seconds, frame]
    .map((part) => part.toString().padStart(2, "0"))
    .join(":");
};

export const timecodeToFrames = (timecode: string, fps: number): number => {
  const match = /^(\d+):(\d{2}):(\d{2}):(\d{2})$/.exec(timecode);
  if (!match || !Number.isInteger(fps) || fps <= 0) {
    throw new RangeError("Expected non-drop timecode HH:MM:SS:FF and a positive integer fps.");
  }
  const [, hoursText, minutesText, secondsText, framesText] = match;
  const [hours, minutes, seconds, frames] = [
    hoursText,
    minutesText,
    secondsText,
    framesText,
  ].map(Number);
  if (minutes >= 60 || seconds >= 60 || frames >= fps) {
    throw new RangeError("Timecode component is outside its valid range.");
  }
  return ((hours * 60 + minutes) * 60 + seconds) * fps + frames;
};

const reelBase = (assetId: string | undefined): string =>
  (assetId ?? "BL")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "BL";

const allocateReelNames = (timeline: InterchangeTimeline): Map<string, string> => {
  const result = new Map<string, string>();
  const used = new Set<string>();
  const assetIds = [...new Set(
    timeline.lanes.flatMap((lane) => lane.items.flatMap((item) => item.assetId ?? [])),
  )].sort();
  for (const assetId of assetIds) {
    const base = reelBase(assetId);
    let candidate = base;
    let suffix = 1;
    while (used.has(candidate)) {
      const suffixText = (suffix++).toString(36).toUpperCase().padStart(2, "0").slice(-2);
      candidate = `${base.slice(0, 6)}${suffixText}`;
    }
    used.add(candidate);
    result.set(assetId, candidate.padEnd(8, " "));
  }
  return result;
};

const edlItemLine = (
  eventNumber: number,
  item: InterchangeItem,
  track: "V" | "A",
  fps: number,
  transition: "C" | "D",
  duration?: number,
  reels?: ReadonlyMap<string, string>,
) => {
  const number = eventNumber.toString().padStart(3, "0");
  const transitionField =
    transition === "D" ? `D ${String(duration ?? 0).padStart(3, "0")}` : "C    ";
  const reel = item.assetId ? reels?.get(item.assetId) : undefined;
  return `${number}  ${reel ?? reelBase(item.assetId).padEnd(8, " ")} ${track}     ${transitionField} ${framesToTimecode(item.sourceIn, fps)} ${framesToTimecode(item.sourceOut, fps)} ${framesToTimecode(item.recordIn, fps)} ${framesToTimecode(item.recordOut, fps)}`;
};

/** Generates a CMX 3600 non-drop-frame EDL, including standard dissolve events. */
export const generateEdl = (timeline: InterchangeTimeline): EdlExportResult => {
  const diagnostics: ExportDiagnostic[] = [...timeline.diagnostics];
  const visualLanes = timeline.lanes.filter(
    (lane) => lane.kind === "video" && lane.items.length > 0,
  );
  const primaryVisualLane = visualLanes[0];
  if (visualLanes.length > 1) {
    diagnostics.push({
      severity: "warning",
      code: "EDL_VIDEO_LANES_OMITTED",
      message: `CMX 3600 supports one picture track; ${visualLanes.length - 1} additional video lane(s) were omitted.`,
    });
  }
  const titleCount = timeline.lanes
    .filter((lane) => lane.kind === "text")
    .reduce((sum, lane) => sum + lane.items.length, 0);
  if (titleCount > 0) {
    diagnostics.push({
      severity: "warning",
      code: "EDL_TITLES_OMITTED",
      message: `CMX 3600 cannot represent titles; ${titleCount} title(s) were omitted.`,
    });
  }

  const safeTitle = timeline.name.replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").trim();
  const lines = [`TITLE: ${safeTitle || "Inkframe Timeline"}`, "FCM: NON-DROP FRAME", ""];
  const totalEvents = (primaryVisualLane?.items.length ?? 0) + timeline.lanes
    .filter((lane) => lane.kind === "audio")
    .reduce((sum, lane) => sum + lane.items.length, 0);
  if (totalEvents > 999) {
    diagnostics.push({
      severity: "error",
      code: "EDL_EVENT_LIMIT_EXCEEDED",
      message: `CMX 3600 supports at most 999 events; this export contains ${totalEvents}.`,
    });
    return { content: `${lines.join("\n").trimEnd()}\n`, diagnostics };
  }
  const reels = allocateReelNames(timeline);
  let eventNumber = 1;
  const items = primaryVisualLane?.items ?? [];
  const transitionsByTarget = new Map(
    timeline.transitions.map((transition) => [transition.toItemId, transition]),
  );
  const normalizeSourceDuration = (item: InterchangeItem): InterchangeItem => {
    const expectedSourceOut = item.sourceIn + (item.recordOut - item.recordIn);
    if (expectedSourceOut === item.sourceOut) return { ...item };
    diagnostics.push({
      severity: "warning",
      code: "EDL_SOURCE_DURATION_NORMALIZED",
      message: `Source duration on ${item.id} was normalized to its record duration because CMX 3600 cannot represent the source mapping.`,
      itemId: item.id,
    });
    return { ...item, sourceOut: expectedSourceOut };
  };
  const edlItems = new Map(items.map((item) => [item.id, normalizeSourceDuration(item)]));
  const representedDissolves = new Set<string>();
  const assetById = new Map(timeline.assets.map((asset) => [asset.id, asset]));
  for (const transition of timeline.transitions) {
    const fromItem = edlItems.get(transition.fromItemId);
    const toItem = edlItems.get(transition.toItemId);
    if (
      transition.kind !== "fade" ||
      !fromItem ||
      !toItem ||
      fromItem.recordOut !== toItem.recordIn
    ) continue;
    const before = Math.floor(transition.durationFrames / 2);
    const after = transition.durationFrames - before;
    const fromAssetDuration = fromItem.assetId
      ? assetById.get(fromItem.assetId)?.durationFrames
      : undefined;
    const hasIncomingHandle = toItem.sourceIn >= before;
    const hasOutgoingHandle =
      fromAssetDuration !== undefined && fromItem.sourceOut + after <= fromAssetDuration;
    if (!hasIncomingHandle || !hasOutgoingHandle) continue;
    edlItems.set(fromItem.id, {
      ...fromItem,
      recordOut: fromItem.recordOut + after,
      sourceOut: fromItem.sourceOut + after,
    });
    edlItems.set(toItem.id, {
      ...toItem,
      recordIn: toItem.recordIn - before,
      sourceIn: toItem.sourceIn - before,
    });
    representedDissolves.add(toItem.id);
  }
  for (const item of items) {
    const edlItem = edlItems.get(item.id) ?? normalizeSourceDuration(item);
    const transition = transitionsByTarget.get(item.id);
    const canDissolve = representedDissolves.has(item.id);
    if (transition && !canDissolve) {
      diagnostics.push({
        severity: "warning",
        code: "EDL_TRANSITION_OMITTED",
        message: `Transition ${transition.id} lacks a supported contiguous edit or sufficient source handles and was omitted.`,
        itemId: transition.id,
      });
    }
    lines.push(
      edlItemLine(
        eventNumber++,
        edlItem,
        "V",
        timeline.fps,
        canDissolve ? "D" : "C",
        canDissolve ? transition?.durationFrames : undefined,
        reels,
      ),
    );
    lines.push(`* FROM CLIP NAME: ${item.name.replace(/[\r\n]+/g, " ")}`);
    if (item.kind === "image") lines.push("* FREEZE FRAME");
    lines.push("");
  }

  const audioItems = timeline.lanes
    .filter((lane) => lane.kind === "audio")
    .flatMap((lane) => lane.items)
    .sort((left, right) => left.recordIn - right.recordIn || left.id.localeCompare(right.id));
  if (timeline.lanes.filter((lane) => lane.kind === "audio" && lane.items.length).length > 1) {
    diagnostics.push({
      severity: "warning",
      code: "EDL_AUDIO_LANES_FLATTENED",
      message: "CMX 3600 audio lanes were flattened into a single audio event list.",
    });
  }
  for (const item of audioItems) {
    const edlItem = normalizeSourceDuration(item);
    lines.push(edlItemLine(eventNumber++, edlItem, "A", timeline.fps, "C", undefined, reels));
    lines.push(`* FROM CLIP NAME: ${item.name.replace(/[\r\n]+/g, " ")}`, "");
  }

  return { content: `${lines.join("\n").trimEnd()}\n`, diagnostics };
};
