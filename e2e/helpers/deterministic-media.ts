import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// Generated per test run: no network assets or codec-dependent golden images.
// ffmpeg/ffprobe are required for this acceptance suite, never silently skipped.
export async function createDeterministicMedia(directory: string) {
  await mkdir(directory, { recursive: true });
  const create = (name: string, color: string, frequency: number, seconds: number) => {
    const path = join(directory, `${name}.mp4`);
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", `color=c=${color}:s=320x180:r=30:d=${seconds}`,
      "-f", "lavfi", "-i", `sine=frequency=${frequency}:sample_rate=48000:duration=${seconds}`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "12",
      "-c:a", "aac", "-b:a", "192k", "-shortest", path], { stdio: "pipe" });
    return path;
  };
  return { base: create("base-red-440hz", "red", 440, 10), overlay: create("pip-blue-880hz", "blue", 880, 4) };
}

export function decodeFrame(path: string, frame: number): Buffer {
  return execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", path,
    "-vf", `select=eq(n\\,${frame}),scale=320:180`, "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 1024 * 1024 });
}

export function pixel(frame: Uint8Array, x: number, y: number): number[] {
  const offset = (y * 320 + x) * 3;
  return [...frame.slice(offset, offset + 3)];
}

export function toneAmplitude(path: string, second: number, frequency: number): number {
  const sampleRate = 48000;
  const pcm = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", path,
    // Select one channel: FFmpeg's default stereo-to-mono mix boosts identical
    // channels by sqrt(2), making a mono source vs stereo export comparison wrong.
    "-ss", String(second), "-t", "0.25", "-vn", "-af", "pan=mono|c0=c0", "-ar", String(sampleRate),
    "-f", "f32le", "pipe:1"], { maxBuffer: 1024 * 1024 });
  let sine = 0;
  let cosine = 0;
  const samples = pcm.length / 4;
  for (let i = 0; i < samples; i++) {
    const value = pcm.readFloatLE(i * 4);
    const phase = 2 * Math.PI * frequency * i / sampleRate;
    sine += value * Math.sin(phase);
    cosine += value * Math.cos(phase);
  }
  return 2 * Math.hypot(sine, cosine) / samples;
}

export function videoFrameCount(path: string): number {
  return Number(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0",
    "-count_frames", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", path], { encoding: "utf8" }).trim());
}

export function hasAudioStream(path: string): boolean {
  return execFileSync("ffprobe", ["-v", "error", "-select_streams", "a",
    "-show_entries", "stream=index", "-of", "csv=p=0", path], { encoding: "utf8" }).trim().length > 0;
}

export async function createTimeMappingMedia(directory: string, vfr: boolean) {
  await mkdir(directory, { recursive: true });
  const path = join(directory, vfr ? "source-time-vfr.mp4" : "source-time-cfr.mp4");
  const inputs = ["red", "lime", "blue", "white", "yellow"].flatMap((color) => [
    "-f", "lavfi", "-i", `color=c=${color}:s=320x180:r=30:d=2`,
  ]);
  const variableRate = vfr ? ",select='if(lt(n,120),not(mod(n,6)),not(mod(n,2)))'" : "";
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...inputs,
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=10",
    "-filter_complex", `[0:v][1:v][2:v][3:v][4:v]concat=n=5:v=1:a=0${variableRate}[v]`,
    "-map", "[v]", "-map", "5:a", "-fps_mode", vfr ? "vfr" : "cfr",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "12",
    "-c:a", "aac", "-shortest", path], { stdio: "pipe" });
  return path;
}

export async function createHighFrameRateMedia(directory: string) {
  await mkdir(directory, { recursive: true });
  const path = join(directory, "alternating-60fps.mp4");
  const frameBytes = 320 * 180 * 3;
  const frames = Buffer.alloc(frameBytes * 120);
  for (let frame = 0; frame < 120; frame++) {
    const channel = frame % 2 === 0 ? 0 : 2;
    for (let pixel = 0; pixel < 320 * 180; pixel++) frames[frame * frameBytes + pixel * 3 + channel] = 255;
  }
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
    "-f", "rawvideo", "-pixel_format", "rgb24", "-video_size", "320x180", "-framerate", "60", "-i", "pipe:0",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "12", path], { input: frames, stdio: ["pipe", "pipe", "pipe"] });
  return path;
}
