import { sourceTimeAtFrame } from "@/lib/editor/time-mapping";

import type {
  ExportDiagnostic,
  InterchangeAsset,
  InterchangeItem,
  InterchangeTimeline,
  InterchangeTitleStyle,
} from "./timeline-interchange";
import {
  classifyFcpxmlTransition,
  serializeFcpxmlClipAutomation,
  serializeFcpxmlTitleAnimation,
} from "./fcpxml-automation";

export interface TextExportResult {
  content: string;
  diagnostics: ExportDiagnostic[];
}

export const escapeXml = (value: string): string =>
  value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "\ufffd")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const rationalTime = (frames: number, fps: number) =>
  frames === 0 ? "0s" : `${frames}/${fps}s`;

const fallbackUri = (asset: InterchangeAsset) =>
  `file:///Inkframe%20Offline/${encodeURIComponent(asset.id)}-${encodeURIComponent(asset.name)}`;

const formatNumber = (value: number, precision = 6): string => {
  if (!Number.isFinite(value)) return "0";
  const rounded = Number(value.toFixed(precision));
  return Object.is(rounded, -0) ? "0" : String(rounded);
};

const fontByFamily: Record<InterchangeTitleStyle["fontFamily"], string> = {
  sans: "Helvetica",
  modern: "Avenir Next",
  serif: "Georgia",
  cursive: "Apple Chancery",
  mono: "Menlo",
  display: "Helvetica Neue",
  editorial: "Georgia",
  rounded: "Arial Rounded MT Bold",
};

const fontFace = (weight: number, italic: boolean): string => {
  const face = weight < 200
    ? "Thin"
    : weight < 300
      ? "UltraLight"
      : weight < 400
        ? "Light"
        : weight < 500
          ? "Regular"
          : weight < 600
            ? "Medium"
            : weight < 700
              ? "Semibold"
              : weight < 800
                ? "Bold"
                : weight < 900
                  ? "Heavy"
                  : "Black";
  return italic ? `${face === "Regular" ? "" : `${face} `}Italic` : face;
};

const colorToFcp = (color: string): string | undefined => {
  const match = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(color.trim());
  if (!match) return undefined;
  const compact = match[1];
  const expanded = compact.length <= 4
    ? [...compact].map((part) => part + part).join("")
    : compact;
  const rgba = expanded.length === 6 ? `${expanded}ff` : expanded;
  return [0, 2, 4, 6]
    .map((offset) => formatNumber(Number.parseInt(rgba.slice(offset, offset + 2), 16) / 255))
    .join(" ");
};

/** Generates deterministic Final Cut Pro XML 1.9 with non-overlapping connected lanes. */
export const generateFcpxml = (
  timeline: InterchangeTimeline,
): TextExportResult => {
  const diagnostics = [...timeline.diagnostics];
  const resourceIds = new Map(
    timeline.assets.map((asset, index) => [asset.id, `r${index + 2}`]),
  );
  const hasTitles = timeline.lanes.some((lane) =>
    lane.items.some((item) => item.kind === "title"),
  );
  const allItems = timeline.lanes.flatMap((lane) => lane.items);
  const assetById = new Map(timeline.assets.map((asset) => [asset.id, asset]));
  const primaryLane = timeline.lanes.find((lane) =>
    lane.kind === "video" && lane.items.some((item) => item.kind === "video" || item.kind === "image"),
  );
  const primaryItems = [...(primaryLane?.items ?? [])]
    .filter((item) => item.kind === "video" || item.kind === "image")
    .sort((left, right) => left.recordIn - right.recordIn || left.id.localeCompare(right.id));
  const primaryIndex = new Map(primaryItems.map((item, index) => [item.id, index]));
  const simplePrimaryStory = Boolean(primaryLane) &&
    allItems.length === primaryItems.length &&
    primaryItems.every((item, index) =>
      (index === 0 || primaryItems[index - 1].recordOut <= item.recordIn) &&
      !item.keyframes && !item.timeMapping && !item.gainEnvelope?.length &&
      !item.fadeInFrames && !item.fadeOutFrames,
    );
  const transitionClassification = timeline.transitions.map((transition) => {
    const fromItem = allItems.find((item) => item.id === transition.fromItemId);
    const toItem = allItems.find((item) => item.id === transition.toItemId);
    const fromIndex = primaryIndex.get(transition.fromItemId);
    const adjacentPrimaryItems = fromIndex !== undefined &&
      primaryItems[fromIndex + 1]?.id === transition.toItemId;
    const classified = classifyFcpxmlTransition({
      transition,
      fromItem,
      toItem,
      fromAssetDurationFrames: fromItem?.assetId
        ? assetById.get(fromItem.assetId)?.durationFrames
        : undefined,
      fromIsRetimed: Boolean(fromItem?.timeMapping && fromItem.timeMapping.kind !== "normal"),
      toIsRetimed: Boolean(toItem?.timeMapping && toItem.timeMapping.kind !== "normal"),
    });
    return { transition, fromItem, toItem, adjacentPrimaryItems, classified };
  });
  const useNativeTransitions = timeline.transitions.length > 0 &&
    simplePrimaryStory &&
    transitionClassification.every(({ adjacentPrimaryItems, classified }) =>
      adjacentPrimaryItems && classified.capability === "native-cross-dissolve",
    );
  let nextResourceNumber = timeline.assets.length + 2;
  const titleResourceId = `r${nextResourceNumber}`;
  if (hasTitles) nextResourceNumber += 1;
  const crossDissolveResourceId = `r${nextResourceNumber}`;
  const textStyleIds = new Map(
    timeline.lanes
      .flatMap((lane) => lane.items)
      .filter((item) => item.kind === "title")
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((item, index) => [item.id, `ts${index + 1}`]),
  );
  const requiredAssetDurations = new Map<string, number>();
  for (const item of timeline.lanes.flatMap((lane) => lane.items)) {
    if (!item.assetId) continue;
    const durationFrames = item.recordOut - item.recordIn;
    const mappedEnd = item.timeMapping && item.timeMapping.kind !== "normal"
      ? Math.ceil(
          sourceTimeAtFrame(
            item.timeMapping,
            durationFrames,
            item.sourceIn,
            timeline.fps,
          ) * timeline.fps / 1_000_000,
        )
      : item.sourceIn + durationFrames;
    const requiredEnd = Math.max(item.sourceOut, mappedEnd);
    requiredAssetDurations.set(
      item.assetId,
      Math.max(requiredAssetDurations.get(item.assetId) ?? 0, requiredEnd),
    );
  }
  const resources = timeline.assets.map((asset) => {
    if (!asset.uri) {
      diagnostics.push({
        severity: "warning",
        code: "FCPXML_OFFLINE_ASSET",
        message: `Asset ${asset.name} has no durable URI and will import as offline media.`,
        itemId: asset.id,
      });
    } else if (/^https?:/i.test(asset.uri)) {
      diagnostics.push({
        severity: "warning",
        code: "FCPXML_REMOTE_ASSET",
        message: `Asset ${asset.name} is linked from its provider URL; use the media bundle if the target editor cannot fetch it.`,
        itemId: asset.id,
      });
    }
    const duration = Math.max(
      1,
      asset.durationFrames ?? 0,
      requiredAssetDurations.get(asset.id) ?? 0,
    );
    const mediaFlags = asset.kind === "audio"
      ? ' hasAudio="1"'
      : ' hasVideo="1"';
    return [
      `    <asset id="${resourceIds.get(asset.id)}" name="${escapeXml(asset.name)}" start="0s" duration="${rationalTime(duration, timeline.fps)}"${mediaFlags}>`,
      `      <media-rep kind="original-media" src="${escapeXml(asset.uri ?? fallbackUri(asset))}"/>`,
      "    </asset>",
    ].join("\n");
  });
  if (hasTitles) {
    resources.push(
      `    <effect id="${titleResourceId}" name="Basic Title" uid=".../Titles.localized/Bumper:Opener.localized/Basic Title.localized/Basic Title.moti"/>`,
    );
  }
  if (useNativeTransitions) {
    resources.push(
      `    <effect id="${crossDissolveResourceId}" name="Cross Dissolve" uid=".../Transitions.localized/Dissolves.localized/Cross Dissolve.localized/Cross Dissolve.motr"/>`,
    );
  }

  const itemLaneNumber = new Map<InterchangeItem, number>();
  let nextPositiveLane = 1;
  let nextNegativeLane = -1;
  for (const lane of timeline.lanes) {
    const sublaneEnds: number[] = [];
    for (const item of lane.items) {
      let sublane = sublaneEnds.findIndex((endFrame) => endFrame <= item.recordIn);
      if (sublane < 0) {
        sublane = sublaneEnds.length;
        sublaneEnds.push(item.recordOut);
      } else {
        sublaneEnds[sublane] = item.recordOut;
      }
      const laneNumber = lane.kind === "audio"
        ? nextNegativeLane - sublane
        : nextPositiveLane + sublane;
      itemLaneNumber.set(item, laneNumber);
    }
    if (lane.kind === "audio") nextNegativeLane -= Math.max(1, sublaneEnds.length);
    else nextPositiveLane += Math.max(1, sublaneEnds.length);
  }
  const renderTitleStyle = (
    item: InterchangeItem,
    styleId: string,
    skipStaticTransform = false,
  ): { intrinsic: string[]; text: string[] } => {
    const style = item.titleStyle;
    if (!style) {
      return {
        intrinsic: [],
        text: [
          `          <text><text-style ref="${styleId}">${escapeXml(item.text ?? "")}</text-style></text>`,
          `          <text-style-def id="${styleId}"><text-style font="Helvetica" fontSize="48"/></text-style-def>`,
        ],
      };
    }
    const fontColor = colorToFcp(style.color);
    if (!fontColor) {
      diagnostics.push({
        severity: "warning",
        code: "FCPXML_TITLE_COLOR_APPROXIMATED",
        message: `Title color ${style.color} on ${item.id} is not a supported hex color and was exported as white.`,
        itemId: item.id,
      });
    }
    const outline = style.contrast === "outline"
      ? ` strokeColor="${colorToFcp("#17120f")}" strokeWidth="${formatNumber(Math.max(2, Math.round(style.fontSize * 0.07)))}"`
      : "";
    const positionX = ((style.x - 50) / 100) * (timeline.width / timeline.height) * 100;
    const positionY = ((50 - style.y) / 100) * 100;
    const textLines = [
      `          <text><text-style ref="${styleId}">${escapeXml(item.text ?? "")}</text-style></text>`,
      `          <text-style-def id="${styleId}"><text-style font="${escapeXml(fontByFamily[style.fontFamily])}" fontSize="${formatNumber(style.fontSize)}" fontFace="${escapeXml(fontFace(style.fontWeight, style.fontStyle === "italic"))}" fontColor="${fontColor ?? "1 1 1 1"}" bold="${style.fontWeight >= 600 ? "1" : "0"}" italic="${style.fontStyle === "italic" ? "1" : "0"}" alignment="${style.textAlign}"${outline}/></text-style-def>`,
    ];
    return {
      intrinsic: skipStaticTransform
        ? []
        : [`          <adjust-transform position="${formatNumber(positionX)} ${formatNumber(positionY)}"/>`],
      text: textLines,
    };
  };
  const renderItem = (
    item: InterchangeItem,
    placement?: {
      lane?: number | null;
      recordIn?: number;
      recordOut?: number;
      sourceIn?: number;
    },
  ): string | undefined => {
    const recordIn = placement?.recordIn ?? item.recordIn;
    const recordOut = placement?.recordOut ?? item.recordOut;
    const sourceIn = placement?.sourceIn ?? item.sourceIn;
    const lane = placement && "lane" in placement
      ? placement.lane
      : itemLaneNumber.get(item);
    const laneAttribute = lane === null || lane === undefined ? "" : ` lane="${lane}"`;
    const disabled = item.kind === "audio" && item.muted ? ' enabled="0"' : "";
    const sourceSelection = item.kind === "video" && (item.muted || (item.volume ?? 1) <= 0)
      ? ' srcEnable="video"'
      : "";
    const common = `name="${escapeXml(item.name)}"${laneAttribute} offset="${rationalTime(recordIn, timeline.fps)}" start="${rationalTime(sourceIn, timeline.fps)}" duration="${rationalTime(recordOut - recordIn, timeline.fps)}"${disabled}${sourceSelection}`;
    if (item.kind === "title") {
      const textStyleId = textStyleIds.get(item.id) ?? "ts0";
      const titleAnimation = item.titleStyle && item.titleAnimation
        ? serializeFcpxmlTitleAnimation({
            fps: timeline.fps,
            width: timeline.width,
            height: timeline.height,
            overlay: {
              id: item.id,
              startFrame: item.recordIn,
              endFrame: item.recordOut,
              x: item.titleStyle.x,
              y: item.titleStyle.y,
              animation: item.titleAnimation,
            },
          })
        : { diagnostics: [] as ExportDiagnostic[] };
      diagnostics.push(...titleAnimation.diagnostics);
      const animatedTransform = titleAnimation.xml?.includes("<adjust-transform ") ?? false;
      const titleStyle = renderTitleStyle(item, textStyleId, animatedTransform);
      return [
        `        <title ref="${titleResourceId}" ${common}>`,
        ...titleStyle.text,
        ...titleStyle.intrinsic,
        ...(titleAnimation.xml ? [`          ${titleAnimation.xml}`] : []),
        "        </title>",
      ].join("\n");
    }
    if (item.kind === "caption") {
      return [
        `        <caption ${common} role="Inkframe Captions?captionFormat=ITT.en">`,
        `          <text placement="bottom">${escapeXml(item.text ?? "")}</text>`,
        "        </caption>",
      ].join("\n");
    }
    const resourceId = item.assetId ? resourceIds.get(item.assetId) : undefined;
    if (!resourceId) return undefined;
    const asset = item.assetId ? assetById.get(item.assetId) : undefined;
    const shouldRenderVolume = (item.volume ?? 1) > 0 && (
      item.volume !== undefined && item.volume !== 1 ||
      Boolean(item.fadeInFrames || item.fadeOutFrames || item.gainEnvelope?.length)
    );
    const automation = serializeFcpxmlClipAutomation({
      itemId: item.id,
      fps: timeline.fps,
      durationFrames: item.recordOut - item.recordIn,
      width: timeline.width,
      height: timeline.height,
      trimStartFrame: item.sourceIn,
      transform: item.transform,
      opacity: item.opacity,
      keyframes: item.keyframes,
      timeMapping: item.timeMapping,
      sourceWidth: asset?.width,
      sourceHeight: asset?.height,
      localStartFrame: item.sourceIn,
      volume: shouldRenderVolume ? item.volume ?? 1 : undefined,
      fadeInFrames: item.fadeInFrames,
      fadeOutFrames: item.fadeOutFrames,
      gainEnvelope: item.gainEnvelope,
    });
    diagnostics.push(...automation.diagnostics);
    const children = [
      ...(automation.xml ? [`          ${automation.xml}`] : []),
    ];
    const audioRole = (item.kind === "audio" || item.kind === "video") && !item.muted
      ? ' audioRole="dialogue"'
      : "";
    if (!children.length) {
      return `        <asset-clip ref="${resourceId}" ${common}${audioRole}/>`;
    }
    return [
      `        <asset-clip ref="${resourceId}" ${common}${audioRole}>`,
      ...children,
      "        </asset-clip>",
    ].join("\n");
  };

  const items = allItems
    .sort((left, right) =>
      left.recordIn - right.recordIn ||
      (itemLaneNumber.get(left) ?? 0) - (itemLaneNumber.get(right) ?? 0) ||
      left.id.localeCompare(right.id),
    )
    .map((item) => renderItem(item))
    .filter((line): line is string => line !== undefined);

  const transitionMarkers: string[] = [];
  if (!useNativeTransitions) for (const {
    transition,
    toItem,
    classified,
  } of transitionClassification) {
    diagnostics.push(...classified.diagnostics);
    if (transition.kind !== "fade") {
      diagnostics.push({
        severity: "warning",
        code: "FCPXML_TRANSITION_APPROXIMATED",
        message: `${transition.kind} transition ${transition.id} was exported as a cross dissolve marker.`,
        itemId: transition.id,
      });
    }
    diagnostics.push({
      severity: "warning",
      code: "FCPXML_CONNECTED_TRANSITION_NOTE",
      message: `Transition ${transition.id} requires reconnection after import; its duration is preserved in a marker.`,
      itemId: transition.id,
    });
    if (toItem) {
      transitionMarkers.push(
        `        <marker start="${rationalTime(toItem.recordIn, timeline.fps)}" duration="${rationalTime(transition.durationFrames, timeline.fps)}" value="Cross Dissolve: ${escapeXml(transition.fromItemId)} to ${escapeXml(transition.toItemId)}"/>`,
      );
    }
  }

  const nativeStoryItems: string[] = [];
  if (useNativeTransitions) {
    const incomingByItemId = new Map(transitionClassification.map((entry) => [
      entry.transition.toItemId,
      entry,
    ]));
    const outgoingByItemId = new Map(transitionClassification.map((entry) => [
      entry.transition.fromItemId,
      entry,
    ]));
    let cursor = 0;
    for (const item of primaryItems) {
      const incoming = incomingByItemId.get(item.id);
      const outgoing = outgoingByItemId.get(item.id);
      if (item.recordIn > cursor) {
        nativeStoryItems.push(
          `            <gap name="Gap" offset="${rationalTime(cursor, timeline.fps)}" start="0s" duration="${rationalTime(item.recordIn - cursor, timeline.fps)}"/>`,
        );
      }
      if (incoming) {
        nativeStoryItems.push(
          `            <transition name="Cross Dissolve" offset="${rationalTime(item.recordIn - incoming.classified.incomingHandleFrames, timeline.fps)}" duration="${rationalTime(incoming.transition.durationFrames, timeline.fps)}"><filter-video ref="${crossDissolveResourceId}"/></transition>`,
        );
      }
      const rendered = renderItem(item, {
        lane: null,
        recordIn: item.recordIn - (incoming?.classified.incomingHandleFrames ?? 0),
        recordOut: item.recordOut + (outgoing?.classified.outgoingHandleFrames ?? 0),
        sourceIn: item.sourceIn - (incoming?.classified.incomingHandleFrames ?? 0),
      });
      if (rendered) nativeStoryItems.push(rendered);
      cursor = item.recordOut;
    }
    if (cursor < timeline.durationFrames) {
      nativeStoryItems.push(
        `            <gap name="Gap" offset="${rationalTime(cursor, timeline.fps)}" start="0s" duration="${rationalTime(timeline.durationFrames - cursor, timeline.fps)}"/>`,
      );
    }
  }

  const spineContents = useNativeTransitions
    ? nativeStoryItems
    : [
        `            <gap name="Inkframe Timeline" offset="0s" start="0s" duration="${rationalTime(timeline.durationFrames, timeline.fps)}">`,
        ...items,
        ...transitionMarkers,
        "            </gap>",
      ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!DOCTYPE fcpxml>",
    '<fcpxml version="1.9">',
    "  <resources>",
    `    <format id="r1" name="FFVideoFormat${timeline.height}p${timeline.fps}" frameDuration="1/${timeline.fps}s" width="${timeline.width}" height="${timeline.height}"/>`,
    ...resources,
    "  </resources>",
    "  <library>",
    `    <event name="${escapeXml(timeline.name)}">`,
    `      <project name="${escapeXml(timeline.name)}">`,
    `        <sequence format="r1" duration="${rationalTime(timeline.durationFrames, timeline.fps)}" tcStart="0s" tcFormat="NDF">`,
    "          <spine>",
    ...spineContents,
    "          </spine>",
    "        </sequence>",
    "      </project>",
    "    </event>",
    "  </library>",
    "</fcpxml>",
    "",
  ].join("\n");
  return { content: xml, diagnostics };
};
