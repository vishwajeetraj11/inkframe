import { buildDuckingEnvelope, type GainPoint } from "@/lib/editor/audio-ducking";
import { evaluateKeyframeChannel, type ClipKeyframes, validateClipKeyframes } from "@/lib/editor/keyframes";
import { sourceTimeAtFrame, type TimeMapping, validateTimeMapping } from "@/lib/editor/time-mapping";
import type { AudioTrack, ClipTransform, TextOverlay, TextOverlayAnimationKind, VersionTimeline } from "@/lib/editor/types";

import type { ExportDiagnostic, InterchangeItem, InterchangeTransition } from "./timeline-interchange";

/** A self-contained fragment suitable for an asset-clip's child content. */
export interface FcpxmlAutomationResult {
  xml?: string;
  diagnostics: ExportDiagnostic[];
}

export interface FcpxmlTransformAutomationInput {
  itemId?: string;
  fps: number;
  durationFrames: number;
  width: number;
  height: number;
  transform?: ClipTransform;
  opacity?: number;
  keyframes?: ClipKeyframes;
  /** Required only when a non-centred Inkframe anchor must be preserved. */
  sourceWidth?: number;
  sourceHeight?: number;
  /** Start of the clip's local timeline. FCPXML keyframe times use this origin. */
  localStartFrame?: number;
}

export interface FcpxmlTimeMapInput {
  itemId?: string;
  fps: number;
  durationFrames: number;
  trimStartFrame: number;
  mapping?: TimeMapping;
}

export interface FcpxmlAudioAutomationInput {
  itemId?: string;
  fps: number;
  durationFrames: number;
  volume: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  /** Output-frame envelope, such as the result of buildDuckingEnvelope. */
  gainEnvelope?: readonly GainPoint[];
  /** Start of the clip's local timeline. FCPXML keyframe times use this origin. */
  localStartFrame?: number;
}

export interface FcpxmlClipAutomationInput extends FcpxmlTransformAutomationInput {
  timeMapping?: TimeMapping;
  trimStartFrame: number;
  volume?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  gainEnvelope?: readonly GainPoint[];
}

export interface FcpxmlTitleAnimationInput {
  /** The editable title whose local intrinsic adjustments are being serialized. */
  overlay: Pick<TextOverlay, "id" | "startFrame" | "endFrame" | "x" | "y" | "animation">;
  fps: number;
  width: number;
  height: number;
}

export interface FcpxmlTransitionHandleInput {
  transition: InterchangeTransition;
  fromItem?: InterchangeItem;
  toItem?: InterchangeItem;
  /** The source duration of the outgoing item, when verified. */
  fromAssetDurationFrames?: number;
  /** Retimed clips cannot safely be expanded for a transition. */
  fromIsRetimed?: boolean;
  toIsRetimed?: boolean;
}

export interface FcpxmlTransitionHandleValidation {
  canUseNativeTransition: boolean;
  incomingHandleFrames: number;
  outgoingHandleFrames: number;
  diagnostics: ExportDiagnostic[];
}

export type FcpxmlTransitionCapability =
  | "native-cross-dissolve"
  | "marker-only"
  | "unsupported";

export interface FcpxmlTransitionCapabilityResult extends FcpxmlTransitionHandleValidation {
  capability: FcpxmlTransitionCapability;
}

const defaultTransform: ClipTransform = {
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  anchor: { x: 0.5, y: 0.5 },
};

const issue = (
  code: string,
  message: string,
  itemId?: string,
  severity: "warning" | "error" = "warning",
): ExportDiagnostic => ({ severity, code, message, ...(itemId ? { itemId } : {}) });

const validFrameContext = (durationFrames: number, fps: number) =>
  Number.isInteger(durationFrames) && durationFrames > 0 &&
  Number.isInteger(fps) && fps > 0;

const greatestCommonDivisor = (left: number, right: number): number => {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};

/** Converts a non-negative whole frame count into FCPXML's rational seconds. */
export const fcpxmlFrameTime = (frames: number, fps: number): string => {
  if (!Number.isInteger(frames) || frames < 0 || !Number.isInteger(fps) || fps <= 0) {
    throw new RangeError("Frames must be non-negative integers and fps must be a positive integer.");
  }
  if (!frames) return "0s";
  const divisor = greatestCommonDivisor(frames, fps);
  const denominator = fps / divisor;
  return denominator === 1 ? `${frames / divisor}s` : `${frames / divisor}/${denominator}s`;
};

/** Converts source microseconds to a bounded rational-second FCPXML time. */
export const fcpxmlSourceTime = (microseconds: number): string => {
  if (!Number.isFinite(microseconds) || microseconds < 0) {
    throw new RangeError("Source time must be finite and non-negative.");
  }
  // Nanoseconds keep ordinary 23.976/29.97-derived source times precise while
  // staying far beneath FCPXML's signed 64-bit numerator limit for Inkframe's
  // maximum timeline duration.
  const numerator = Math.round(microseconds * 1_000);
  if (!Number.isSafeInteger(numerator)) throw new RangeError("Source time is outside the supported rational range.");
  if (!numerator) return "0s";
  const divisor = greatestCommonDivisor(numerator, 1_000_000_000);
  const denominator = 1_000_000_000 / divisor;
  return denominator === 1 ? `${numerator / divisor}s` : `${numerator / divisor}/${denominator}s`;
};

const compactNumber = (value: number): string => {
  if (!Number.isFinite(value)) throw new RangeError("FCPXML values must be finite.");
  return Number(value.toFixed(9)).toString();
};

const keyframeAnimationContent = (
  values: readonly { frame: number; value: string; interpolation: "linear" | "ease" | "easeIn" | "easeOut" }[],
  fps: number,
  localStartFrame = 0,
) => values.length
  ? `<keyframeAnimation>${values.map((point) => `<keyframe time="${fcpxmlFrameTime(localStartFrame + point.frame, fps)}" value="${point.value}" interp="${point.interpolation}" curve="linear"/>`).join("")}</keyframeAnimation>`
  : undefined;

const keyframeAnimation = (
  name: string,
  values: readonly { frame: number; value: string; interpolation: "linear" | "ease" | "easeIn" | "easeOut" }[],
  fps: number,
  localStartFrame = 0,
) => {
  const content = keyframeAnimationContent(values, fps, localStartFrame);
  return content ? `<param name="${name}">${content}</param>` : undefined;
};

const channelInterpolation = (
  points: readonly { frame: number; interpolation: "linear" | "hold" }[] | undefined,
  frame: number,
): "linear" | "hold" => {
  if (!points?.length) return "linear";
  let active = points[0];
  for (const point of points) {
    if (point.frame > frame) break;
    active = point;
  }
  return active.interpolation;
};

const hasHold = (points: readonly { interpolation: "linear" | "hold" }[] | undefined) =>
  points?.some((point) => point.interpolation === "hold") ?? false;

const transformPosition = (
  transform: ClipTransform,
  width: number,
  height: number,
) => `${compactNumber((transform.x - 0.5) * width / height * 100)} ${compactNumber((0.5 - transform.y) * 100)}`;

const transformAnchor = (
  transform: ClipTransform,
  width: number | undefined,
  height: number | undefined,
) => width && height
  && Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
  ? `${compactNumber((transform.anchor.x - 0.5) * width / height * 100)} ${compactNumber((0.5 - transform.anchor.y) * 100)}`
  : undefined;

const positionKeyframes = (
  input: FcpxmlTransformAutomationInput,
  base: ClipTransform,
  diagnostics: ExportDiagnostic[],
): string | undefined => {
  const x = input.keyframes?.x;
  const y = input.keyframes?.y;
  if (!x?.length && !y?.length) return undefined;
  if (hasHold(x) || hasHold(y)) {
    diagnostics.push(issue("FCPXML_POSITION_HOLD_UNSUPPORTED", "Position hold keyframes were omitted because FCPXML intrinsic Position has no exact hold interpolation.", input.itemId));
    return undefined;
  }
  const frames = [...new Set([0, ...x?.map((point) => point.frame) ?? [], ...y?.map((point) => point.frame) ?? []])].sort((a, b) => a - b);
  const values = frames.map((frame) => {
    const value = { ...base, x: evaluateKeyframeChannel(x, frame, base.x), y: evaluateKeyframeChannel(y, frame, base.y) };
    const xInterpolation = channelInterpolation(x, frame);
    const yInterpolation = channelInterpolation(y, frame);
    if (xInterpolation !== yInterpolation) {
      diagnostics.push(issue("FCPXML_POSITION_INTERPOLATION_CONFLICT", "Position keyframes were omitted because X and Y use different interpolation at the same time.", input.itemId));
      return undefined;
    }
    return { frame, value: transformPosition(value, input.width, input.height), interpolation: "linear" as const };
  });
  return values.every(Boolean)
    ? keyframeAnimation("position", values as { frame: number; value: string; interpolation: "linear" }[], input.fps, input.localStartFrame)
    : undefined;
};

const scalarTransformKeyframes = (
  input: FcpxmlTransformAutomationInput,
  property: "scale" | "rotation",
  fallback: number,
  diagnostics: ExportDiagnostic[],
): string | undefined => {
  const channel = input.keyframes?.[property];
  if (!channel?.length) return undefined;
  if (hasHold(channel)) {
    diagnostics.push(issue(`FCPXML_${property.toUpperCase()}_HOLD_UNSUPPORTED`, `${property} hold keyframes were omitted because FCPXML intrinsic animation has no exact hold interpolation.`, input.itemId));
    return undefined;
  }
  const name = property;
  const values = [...new Set([0, ...channel.map((point) => point.frame)])]
    .sort((a, b) => a - b)
    .map((frame) => {
      const value = evaluateKeyframeChannel(channel, frame, fallback);
      const serialized = property === "scale"
        ? `${compactNumber(value)} ${compactNumber(value)}`
        : compactNumber(-value * 180 / Math.PI);
      return { frame, value: serialized, interpolation: "linear" as const };
    });
  return keyframeAnimation(name, values, input.fps, input.localStartFrame);
};

/**
 * Serializes intrinsic transform and blend adjustments. Inkframe positions are
 * normalized canvas coordinates; FCPXML positions are percentages of frame
 * height, and clockwise canvas rotation is converted to counter-clockwise FCP
 * degrees.
 */
export const serializeFcpxmlTransformAutomation = (
  input: FcpxmlTransformAutomationInput,
): FcpxmlAutomationResult => {
  const diagnostics: ExportDiagnostic[] = [];
  if (!validFrameContext(input.durationFrames, input.fps) || !Number.isFinite(input.width) || input.width <= 0 || !Number.isFinite(input.height) || input.height <= 0 || !Number.isInteger(input.localStartFrame ?? 0) || (input.localStartFrame ?? 0) < 0) {
    return { diagnostics: [issue("FCPXML_INVALID_TRANSFORM_CONTEXT", "Transform automation needs positive integer duration/fps and positive timeline dimensions.", input.itemId, "error")] };
  }
  const keyframeIssues = validateClipKeyframes(input.keyframes, input.durationFrames);
  const base = { ...defaultTransform, ...input.transform, anchor: { ...defaultTransform.anchor, ...input.transform?.anchor } };
  const staticOpacity = input.opacity;
  if (keyframeIssues.length) {
    diagnostics.push(issue("FCPXML_INVALID_KEYFRAMES", `Keyframes were omitted: ${keyframeIssues.join(" ")}`, input.itemId));
  }
  const validKeyframes = keyframeIssues.length ? undefined : input.keyframes;
  const staticTransformPresent = Boolean(input.transform) || Boolean(validKeyframes?.x?.length || validKeyframes?.y?.length || validKeyframes?.scale?.length || validKeyframes?.rotation?.length);
  const transformIsValid = [base.x, base.y, base.scale, base.rotation, base.anchor.x, base.anchor.y].every(Number.isFinite) &&
    base.scale > 0 && base.anchor.x >= 0 && base.anchor.x <= 1 && base.anchor.y >= 0 && base.anchor.y <= 1;
  if (staticTransformPresent && !transformIsValid) {
    diagnostics.push(issue("FCPXML_INVALID_TRANSFORM", "Transform automation was omitted because the static transform is invalid.", input.itemId));
  }
  const transformParts: string[] = [];
  if (staticTransformPresent && transformIsValid) {
    const attrs = [
      `position="${transformPosition(base, input.width, input.height)}"`,
      `scale="${compactNumber(base.scale)} ${compactNumber(base.scale)}"`,
      `rotation="${compactNumber(-base.rotation * 180 / Math.PI)}"`,
    ];
    const centredAnchor = base.anchor.x === 0.5 && base.anchor.y === 0.5;
    const anchor = transformAnchor(base, input.sourceWidth, input.sourceHeight);
    if (anchor) attrs.push(`anchor="${anchor}"`);
    else if (!centredAnchor) diagnostics.push(issue("FCPXML_ANCHOR_OMITTED", "A non-centred anchor needs verified source dimensions and was omitted.", input.itemId));
    const animationInput = { ...input, keyframes: validKeyframes };
    const position = positionKeyframes(animationInput, base, diagnostics);
    const scale = scalarTransformKeyframes(animationInput, "scale", base.scale, diagnostics);
    const rotation = scalarTransformKeyframes(animationInput, "rotation", base.rotation, diagnostics);
    transformParts.push(`<adjust-transform ${attrs.join(" ")}>${[position, scale, rotation].filter(Boolean).join("")}</adjust-transform>`);
  }
  const opacity = validKeyframes?.opacity;
  const opacityPresent = staticOpacity !== undefined || Boolean(opacity?.length);
  if (opacityPresent) {
    if (hasHold(opacity)) {
      diagnostics.push(issue("FCPXML_OPACITY_HOLD_UNSUPPORTED", "Opacity hold keyframes were omitted because FCPXML intrinsic animation has no exact hold interpolation.", input.itemId));
      transformParts.push(`<adjust-blend amount="${compactNumber(staticOpacity ?? evaluateKeyframeChannel(opacity, 0, 1))}" mode="normal"/>`);
    } else {
      const initial = evaluateKeyframeChannel(opacity, 0, staticOpacity ?? 1);
      const values = opacity?.length
        ? [...new Set([0, ...opacity.map((point) => point.frame)])].sort((a, b) => a - b).map((frame) => ({ frame, value: compactNumber(evaluateKeyframeChannel(opacity, frame, staticOpacity ?? 1)), interpolation: "linear" as const }))
        : [];
      transformParts.push(`<adjust-blend amount="${compactNumber(initial)}" mode="normal">${keyframeAnimation("amount", values, input.fps, input.localStartFrame) ?? ""}</adjust-blend>`);
    }
  }
  return { ...(transformParts.length ? { xml: transformParts.join("") } : {}), diagnostics };
};

const isContentReveal = (kind: TextOverlayAnimationKind | undefined) =>
  kind === "typewriter" || kind === "word-reveal";

const isVisualTitleAnimation = (kind: TextOverlayAnimationKind | undefined) =>
  kind === "fade" || kind === "rise" || kind === "slide-left" || kind === "punch";

const isSpatialTitleAnimation = (kind: TextOverlayAnimationKind | undefined) =>
  kind === "rise" || kind === "slide-left" || kind === "punch";

const easeOutCubic = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value));
  return 1 - (1 - clamped) ** 3;
};

/**
 * Serializes the visual subset of Inkframe title motion as title-local
 * intrinsic adjustments. The source cubic easing is sampled at each output
 * frame, avoiding an assumption that FCPXML's named ease curve is identical.
 */
export const serializeFcpxmlTitleAnimation = (
  input: FcpxmlTitleAnimationInput,
): FcpxmlAutomationResult => {
  const { overlay } = input;
  const durationFrames = overlay.endFrame - overlay.startFrame;
  if (!validFrameContext(durationFrames, input.fps) || !Number.isFinite(input.width) || input.width <= 0 || !Number.isFinite(input.height) || input.height <= 0 || !Number.isFinite(overlay.x) || !Number.isFinite(overlay.y)) {
    return { diagnostics: [issue("FCPXML_INVALID_TITLE_ANIMATION_CONTEXT", "Title animation needs positive timing/dimensions and finite title position.", overlay.id, "error")] };
  }
  const animation = overlay.animation;
  if (!animation?.in && !animation?.out) return { diagnostics: [] };
  const diagnostics: ExportDiagnostic[] = [];
  if (!Number.isInteger(animation.durationFrames) || animation.durationFrames <= 0) {
    return { diagnostics: [issue("FCPXML_INVALID_TITLE_ANIMATION_DURATION", "Title animation was omitted because its duration must be a positive integer frame count.", overlay.id)] };
  }
  const motionDuration = Math.min(durationFrames, animation.durationFrames);
  for (const [side, kind] of [["in", animation.in], ["out", animation.out]] as const) {
    if (isContentReveal(kind)) {
      diagnostics.push(issue("FCPXML_TITLE_CONTENT_REVEAL_UNSUPPORTED", `${kind} ${side} animation on ${overlay.id} changes title text over time and was omitted.`, overlay.id));
    }
  }
  const supportedIn = isVisualTitleAnimation(animation.in) ? animation.in : undefined;
  const supportedOut = isVisualTitleAnimation(animation.out) ? animation.out : undefined;
  if (!supportedIn && !supportedOut) return { diagnostics };

  const frames = new Set<number>([0, durationFrames]);
  const addRange = (start: number, end: number) => {
    for (let frame = start; frame <= end; frame += 1) frames.add(frame);
  };
  if (supportedIn) addRange(0, motionDuration);
  if (supportedOut) addRange(durationFrames - motionDuration, durationFrames);
  const orderedFrames = [...frames].sort((left, right) => left - right);
  const base: ClipTransform = {
    x: overlay.x / 100,
    y: overlay.y / 100,
    scale: 1,
    rotation: 0,
    anchor: { x: 0.5, y: 0.5 },
  };
  const progressIn = (frame: number) => easeOutCubic(frame / motionDuration);
  const progressOut = (frame: number) => easeOutCubic((durationFrames - frame) / motionDuration);
  const visualAt = (frame: number) => {
    let x = base.x;
    let y = base.y;
    let scale = 1;
    let opacity = 1;
    if (supportedIn) {
      const progress = progressIn(frame);
      opacity = Math.min(opacity, progress);
      if (supportedIn === "rise") y += (1 - progress) * 0.06;
      if (supportedIn === "slide-left") x -= (1 - progress) * 0.08;
      if (supportedIn === "punch") scale *= 0.76 + 0.24 * progress;
    }
    if (supportedOut) {
      const progress = progressOut(frame);
      opacity = Math.min(opacity, progress);
      if (supportedOut === "rise") y -= (1 - progress) * 0.05;
      if (supportedOut === "slide-left") x += (1 - progress) * 0.08;
      if (supportedOut === "punch") scale *= 0.84 + 0.16 * progress;
    }
    return { x, y, scale, opacity };
  };
  const parts: string[] = [];
  if (isSpatialTitleAnimation(supportedIn) || isSpatialTitleAnimation(supportedOut)) {
    const positionValues = orderedFrames.map((frame) => {
      const state = visualAt(frame);
      return { frame, value: transformPosition({ ...base, x: state.x, y: state.y }, input.width, input.height), interpolation: "linear" as const };
    });
    const scaleValues = orderedFrames.map((frame) => {
      const state = visualAt(frame);
      return { frame, value: `${compactNumber(state.scale)} ${compactNumber(state.scale)}`, interpolation: "linear" as const };
    });
    const positionChanges = positionValues.some((point) => point.value !== positionValues[0].value);
    const scaleChanges = scaleValues.some((point) => point.value !== scaleValues[0].value);
    const transformChildren = [
      positionChanges ? keyframeAnimation("position", positionValues, input.fps) : undefined,
      scaleChanges ? keyframeAnimation("scale", scaleValues, input.fps) : undefined,
    ].filter(Boolean).join("");
    parts.push(`<adjust-transform position="${transformPosition(base, input.width, input.height)}" scale="1 1" rotation="0">${transformChildren}</adjust-transform>`);
  }
  const opacityValues = orderedFrames.map((frame) => ({
    frame,
    value: compactNumber(visualAt(frame).opacity),
    interpolation: "linear" as const,
  }));
  const initialOpacity = opacityValues[0].value;
  const opacityChanges = opacityValues.some((point) => point.value !== initialOpacity);
  parts.push(`<adjust-blend amount="${initialOpacity}" mode="normal">${opacityChanges ? keyframeAnimation("amount", opacityValues, input.fps) ?? "" : ""}</adjust-blend>`);
  return { xml: parts.join(""), diagnostics };
};

const isSpeedRamp = (mapping: Extract<TimeMapping, { kind: "speed" }>) =>
  mapping.points.some((point, index) => {
    const next = mapping.points[index + 1];
    return Boolean(next && point.interpolation === "linear" && point.speed !== next.speed);
  });

/**
 * Serializes a timeMap. Linear Inkframe speed ramps are sampled at each output
 * frame, so every output-frame source sample remains deterministic without
 * claiming FCPXML's smooth curve matches Inkframe's quadratic speed integral.
 */
export const serializeFcpxmlTimeMap = (input: FcpxmlTimeMapInput): FcpxmlAutomationResult => {
  const mapping = input.mapping;
  if (!mapping || mapping.kind === "normal") return { diagnostics: [] };
  if (!validFrameContext(input.durationFrames, input.fps) || !Number.isInteger(input.trimStartFrame) || input.trimStartFrame < 0) {
    return { diagnostics: [issue("FCPXML_INVALID_TIMEMAP_CONTEXT", "Time mapping needs positive integer duration/fps and a non-negative source trim.", input.itemId, "error")] };
  }
  const validation = validateTimeMapping(mapping, input.durationFrames, input.trimStartFrame, undefined, input.fps);
  if (validation.length) return { diagnostics: [issue("FCPXML_INVALID_TIMEMAP", `Time map was omitted: ${validation.join(" ")}`, input.itemId)] };

  const diagnostics: ExportDiagnostic[] = [];
  const frames = new Set<number>([0, input.durationFrames]);
  if (mapping.kind === "speed") {
    for (const point of mapping.points) frames.add(point.frame);
    if (isSpeedRamp(mapping)) {
      for (let frame = 1; frame < input.durationFrames; frame += 1) frames.add(frame);
      diagnostics.push(issue("FCPXML_SPEED_RAMP_SAMPLED", "Linear speed ramps were serialized as one linear time-map segment per output frame.", input.itemId));
    }
  }
  const points = [...frames].sort((a, b) => a - b).map((frame) => {
    const sourceTime = sourceTimeAtFrame(mapping, frame, input.trimStartFrame, input.fps);
    return `<timept time="${fcpxmlFrameTime(input.trimStartFrame + frame, input.fps)}" value="${fcpxmlSourceTime(sourceTime)}" interp="linear"/>`;
  });
  return { xml: `<timeMap frameSampling="floor">${points.join("")}</timeMap>`, diagnostics };
};

const gainToDecibels = (gain: number): number | undefined => {
  if (!Number.isFinite(gain) || gain < 0) return undefined;
  return gain === 0 ? undefined : 20 * Math.log10(gain);
};

const evaluateLinearEnvelope = (points: readonly GainPoint[] | undefined, frame: number): number => {
  if (!points?.length) return 1;
  const exact = points.filter((point) => point.frame === frame).at(-1);
  if (exact) return exact.value;
  const rightIndex = points.findIndex((point) => point.frame > frame);
  if (rightIndex < 0) return points.at(-1)?.value ?? 1;
  if (rightIndex === 0) return points[0].value;
  const left = points[rightIndex - 1];
  const right = points[rightIndex];
  return left.value + (right.value - left.value) * (frame - left.frame) / (right.frame - left.frame);
};

/** Serializes static volume, fades, and a continuous ducking envelope in dB. */
export const serializeFcpxmlAudioAutomation = (
  input: FcpxmlAudioAutomationInput,
): FcpxmlAutomationResult => {
  if (!validFrameContext(input.durationFrames, input.fps) || !Number.isFinite(input.volume) || input.volume < 0 || !Number.isInteger(input.fadeInFrames ?? 0) || !Number.isInteger(input.fadeOutFrames ?? 0) || !Number.isInteger(input.localStartFrame ?? 0) || (input.localStartFrame ?? 0) < 0) {
    return { diagnostics: [issue("FCPXML_INVALID_AUDIO_AUTOMATION", "Audio automation needs valid duration/fps, non-negative finite volume, and integer fades.", input.itemId, "error")] };
  }
  const fadeIn = Math.min(input.durationFrames, Math.max(0, input.fadeInFrames ?? 0));
  const fadeOut = Math.min(input.durationFrames, Math.max(0, input.fadeOutFrames ?? 0));
  const envelope = input.gainEnvelope;
  const diagnostics: ExportDiagnostic[] = [];
  if (envelope?.some((point, index) => !Number.isFinite(point.value) || point.value < 0 || !Number.isFinite(point.frame) || !Number.isInteger(point.frame) || point.frame < 0 || point.frame > input.durationFrames || (index > 0 && point.frame < envelope[index - 1].frame))) {
    return { diagnostics: [issue("FCPXML_INVALID_AUDIO_ENVELOPE", "Audio envelope was omitted because it contains invalid points.", input.itemId)] };
  }
  // Identical-time points in Inkframe encode a discontinuity. FCPXML intrinsic
  // volume keyframes do not have a matching hold/jump primitive.
  if (envelope?.some((point, index) => index > 0 && point.frame === envelope[index - 1].frame && point.value !== envelope[index - 1].value)) {
    return { diagnostics: [issue("FCPXML_AUDIO_JUMP_UNSUPPORTED", "Audio automation was omitted because the ducking envelope contains an instantaneous jump.", input.itemId)] };
  }
  const frames = new Set<number>([0, input.durationFrames]);
  for (const point of envelope ?? []) frames.add(point.frame);
  const gains = [...frames].sort((a, b) => a - b).map((frame) => ({
    frame,
    gain: input.volume * evaluateLinearEnvelope(envelope, frame),
  }));
  const initialGain = gains[0].gain;
  const initialDb = gainToDecibels(initialGain);
  if (initialDb === undefined) {
    return { diagnostics: [issue("FCPXML_SILENCE_UNSUPPORTED", "A zero-gain audio automation cannot be represented exactly as an FCPXML dB value and was omitted.", input.itemId)] };
  }
  const values: { frame: number; value: string; interpolation: "linear" }[] = [];
  for (const point of gains) {
    const decibels = gainToDecibels(point.gain);
    if (decibels === undefined) {
      return { diagnostics: [issue("FCPXML_SILENCE_UNSUPPORTED", "A zero-gain fade or ducking point cannot be represented exactly as an FCPXML dB value and was omitted.", input.itemId)] };
    }
    values.push({ frame: point.frame, value: `${compactNumber(decibels)}dB`, interpolation: "linear" });
  }
  const animated = values.some((point) => point.value !== values[0].value);
  const fadeChildren = [
    fadeIn ? `<fadeIn type="linear" duration="${fcpxmlFrameTime(fadeIn, input.fps)}"/>` : "",
    fadeOut ? `<fadeOut type="linear" duration="${fcpxmlFrameTime(fadeOut, input.fps)}"/>` : "",
  ].join("");
  const animation = animated ? keyframeAnimationContent(values, input.fps, input.localStartFrame) ?? "" : "";
  const child = fadeChildren || animation
    ? `<param name="amount">${fadeChildren}${animation}</param>`
    : "";
  return { xml: `<adjust-volume amount="${compactNumber(initialDb)}dB">${child}</adjust-volume>`, diagnostics };
};

/** Builds a target audio item's FCPXML-safe ducking envelope from a version. */
export const duckingEnvelopeForFcpxml = (
  version: VersionTimeline,
  target: { kind: "audio" | "video"; id: string },
): GainPoint[] | undefined => buildDuckingEnvelope(version, target);

/** Returns child fragments in FCPXML's required timing → video → audio order. */
export const serializeFcpxmlClipAutomation = (
  input: FcpxmlClipAutomationInput,
): FcpxmlAutomationResult => {
  const timeMap = serializeFcpxmlTimeMap({
    itemId: input.itemId,
    fps: input.fps,
    durationFrames: input.durationFrames,
    trimStartFrame: input.trimStartFrame,
    mapping: input.timeMapping,
  });
  const transform = serializeFcpxmlTransformAutomation(input);
  const audio = input.volume === undefined
    ? { diagnostics: [] as ExportDiagnostic[] }
    : serializeFcpxmlAudioAutomation({
      itemId: input.itemId,
      fps: input.fps,
      durationFrames: input.durationFrames,
      volume: input.volume,
      fadeInFrames: input.fadeInFrames,
      fadeOutFrames: input.fadeOutFrames,
      gainEnvelope: input.gainEnvelope,
      localStartFrame: input.trimStartFrame,
    });
  const conform = transform.xml?.includes("<adjust-transform ")
    ? '<adjust-conform type="none"/>'
    : undefined;
  const xml = [timeMap.xml, conform, transform.xml, audio.xml].filter(Boolean).join("");
  return { ...(xml ? { xml } : {}), diagnostics: [...timeMap.diagnostics, ...transform.diagnostics, ...audio.diagnostics] };
};

/** Verifies the outgoing and incoming source handles needed by a centered dissolve. */
export const validateFcpxmlTransitionHandles = (
  input: FcpxmlTransitionHandleInput,
): FcpxmlTransitionHandleValidation => {
  const { transition, fromItem, toItem } = input;
  const incomingHandleFrames = Math.floor(transition.durationFrames / 2);
  const outgoingHandleFrames = transition.durationFrames - incomingHandleFrames;
  const diagnostics: ExportDiagnostic[] = [];
  if (!Number.isInteger(transition.durationFrames) || transition.durationFrames <= 0) {
    diagnostics.push(issue("FCPXML_INVALID_TRANSITION_DURATION", `Transition ${transition.id} has an invalid duration.`, transition.id, "error"));
  }
  if (!fromItem || !toItem) {
    diagnostics.push(issue("FCPXML_TRANSITION_MISSING_ITEM", `Transition ${transition.id} references an item that is unavailable for export.`, transition.id, "error"));
  } else {
    if (fromItem.recordOut !== toItem.recordIn) diagnostics.push(issue("FCPXML_TRANSITION_NONCONTIGUOUS", `Transition ${transition.id} connects non-contiguous edits.`, transition.id));
    if (fromItem.sourceIn < 0 || toItem.sourceIn < incomingHandleFrames) diagnostics.push(issue("FCPXML_TRANSITION_INSUFFICIENT_INCOMING_HANDLE", `Transition ${transition.id} needs ${incomingHandleFrames} incoming source frame(s) on ${toItem.id}.`, transition.id));
    if (input.fromAssetDurationFrames === undefined) diagnostics.push(issue("FCPXML_TRANSITION_SOURCE_BOUND_UNKNOWN", `Transition ${transition.id} needs a verified source duration to validate the outgoing handle.`, transition.id));
    else if (fromItem.sourceOut + outgoingHandleFrames > input.fromAssetDurationFrames) diagnostics.push(issue("FCPXML_TRANSITION_INSUFFICIENT_OUTGOING_HANDLE", `Transition ${transition.id} needs ${outgoingHandleFrames} outgoing source frame(s) on ${fromItem.id}.`, transition.id));
  }
  if (input.fromIsRetimed || input.toIsRetimed) diagnostics.push(issue("FCPXML_TRANSITION_RETIMED_CLIP", `Transition ${transition.id} touches a retimed clip and cannot be expanded safely.`, transition.id));
  return { canUseNativeTransition: !diagnostics.length, incomingHandleFrames, outgoingHandleFrames, diagnostics };
};

/**
 * FCPXML 1.9 can natively express a validated fade only when the caller emits
 * a primary-spine transition. Slide/wipe require effect UIDs Inkframe does not
 * own, so they remain explicit markers rather than guessed transitions.
 */
export const classifyFcpxmlTransition = (
  input: FcpxmlTransitionHandleInput,
): FcpxmlTransitionCapabilityResult => {
  const validation = validateFcpxmlTransitionHandles(input);
  if (!validation.canUseNativeTransition) return { ...validation, capability: "unsupported" };
  if (input.transition.kind === "fade") return { ...validation, capability: "native-cross-dissolve" };
  return {
    ...validation,
    capability: "marker-only",
    diagnostics: [...validation.diagnostics, issue("FCPXML_TRANSITION_EFFECT_UNAVAILABLE", `${input.transition.kind} transition ${input.transition.id} requires an effect UID and should be emitted as a marker.`, input.transition.id)],
  };
};

/** Convenience narrowing used by callers that already have an AudioTrack. */
export const serializeFcpxmlAudioTrackAutomation = (
  track: AudioTrack,
  fps: number,
  gainEnvelope?: readonly GainPoint[],
): FcpxmlAutomationResult => serializeFcpxmlAudioAutomation({
  itemId: track.id,
  fps,
  durationFrames: track.endFrame - track.startFrame,
  volume: track.muted ? 0 : track.volume,
  fadeInFrames: track.fadeInFrames,
  fadeOutFrames: track.fadeOutFrames,
  gainEnvelope,
});
