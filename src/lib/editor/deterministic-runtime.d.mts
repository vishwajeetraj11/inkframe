export interface RuntimePoint { frame: number; value: number; interpolation?: "linear" | "hold" }
export interface RuntimeSpeedPoint { frame: number; speed: number; interpolation?: "linear" | "hold" }
export type RuntimeTimeMap = { kind: "normal" } | { kind: "hold"; sourceTimeUs: number } | { kind: "speed"; points: RuntimeSpeedPoint[]; sourceStartTimeUs?: number };
export function evaluateChannel(points: readonly RuntimePoint[] | undefined, frame: number, fallback?: number): number;
export function evaluateTimeMap(mapping: RuntimeTimeMap | undefined, frame: number, trimStartFrame: number, fps?: number): number;
export function evaluateGainEnvelope(points: readonly RuntimePoint[] | undefined, frame: number): number;
export function evaluateAudioGain(clip: { durationFrames: number; volume?: number; fadeInFrames?: number; fadeOutFrames?: number; gainEnvelope?: readonly RuntimePoint[] }, frame: number, trackGain?: number): number;
export function evaluateClip<T>(clip: T, localFrame: number): T;
