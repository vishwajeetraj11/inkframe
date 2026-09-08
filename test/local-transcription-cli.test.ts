import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts", "transcribe-local.py");
const python = process.env.PYTHON ?? "python3";

describe("local transcription CLI", () => {
  it("prints help without requiring Whisper", () => {
    const result = spawnSync(python, [script, "--help"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--allow-model-download");
    expect(result.stdout).toContain("--output");
  });

  it("reports executable status as JSON without claiming model readiness", () => {
    const output = execFileSync(python, [script, "--check"], { encoding: "utf8" });
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(typeof parsed.whisperInstalled).toBe("boolean");
    expect(parsed).not.toHaveProperty("modelReady");
  });

  it("rejects a missing local input before invoking Whisper", () => {
    const directory = mkdtempSync(join(tmpdir(), "transcribe-cli-test-"));
    const result = spawnSync(python, [script, join(directory, "missing.wav"), "--output", join(directory, "out.json")], { encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("does not exist");
  });

  it("protects an existing output unless overwrite is explicit", () => {
    const directory = mkdtempSync(join(tmpdir(), "transcribe-cli-test-"));
    const input = join(directory, "input.wav");
    const output = join(directory, "out.json");
    writeFileSync(input, "not-a-real-wav");
    writeFileSync(output, '{"keep":true}\n');
    const result = spawnSync(python, [script, input, "--output", output], { encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--overwrite");
  });

  it("runs an offline cached model with absolute paths and validates JSON", () => {
    const directory = mkdtempSync(join(tmpdir(), "transcribe-cli-test-"));
    const cache = join(directory, "whisper");
    const bin = join(directory, "bin");
    const log = join(directory, "model-arg.txt");
    const input = join(directory, "input.wav");
    const output = join(directory, "out.json");
    const mock = join(bin, "whisper");
    mkdirSync(cache); mkdirSync(bin);
    writeFileSync(input, "fake wav");
    writeFileSync(join(cache, "base.pt"), "cached");
    writeFileSync(mock, `#!/bin/sh
model=''; out=''; input="$1"; shift
while [ "$#" -gt 0 ]; do case "$1" in --model) model="$2"; shift 2;; --output_dir) out="$2"; shift 2;; *) shift;; esac; done
printf '%s' "$model" > "$MOCK_LOG"
printf '{"segments":[{"start":0,"end":1.25,"text":" hello "}]}' > "$out/$(basename "$input" .wav).json"
`);
    chmodSync(mock, 0o755);
    const result = spawnSync(python, [script, input, "--output", output], {
      encoding: "utf8", env: { ...process.env, PATH: `${bin}:/usr/bin:/bin`, XDG_CACHE_HOME: directory, MOCK_LOG: log },
    });
    expect(result.status).toBe(0);
    expect(readFileSync(log, "utf8")).toBe(join(cache, "base.pt"));
    const transcript = JSON.parse(readFileSync(output, "utf8"));
    expect(transcript).toEqual({ segments: [{ start: 0, end: 1.25, text: " hello " }] });
  });

  it("rejects malformed Whisper JSON without creating output", () => {
    const directory = mkdtempSync(join(tmpdir(), "transcribe-cli-test-"));
    const cache = join(directory, "whisper");
    const bin = join(directory, "bin");
    const input = join(directory, "input.wav");
    const output = join(directory, "out.json");
    const mock = join(bin, "whisper");
    mkdirSync(cache); mkdirSync(bin);
    writeFileSync(input, "fake wav");
    writeFileSync(join(cache, "base.pt"), "cached");
    writeFileSync(mock, `#!/bin/sh
out=''; input="$1"; shift
while [ "$#" -gt 0 ]; do case "$1" in --output_dir) out="$2"; shift 2;; *) shift;; esac; done
printf '{}' > "$out/$(basename "$input" .wav).json"
`);
    chmodSync(mock, 0o755);
    const result = spawnSync(python, [script, input, "--output", output], {
      encoding: "utf8", env: { ...process.env, PATH: `${bin}:/usr/bin:/bin`, XDG_CACHE_HOME: directory },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("segments array");
  });

  it("rejects zero-duration and overlapping segments", () => {
    const directory = mkdtempSync(join(tmpdir(), "transcribe-cli-test-"));
    const cache = join(directory, "whisper"); const bin = join(directory, "bin");
    const input = join(directory, "input.wav"); const output = join(directory, "out.json");
    const mock = join(bin, "whisper"); mkdirSync(cache); mkdirSync(bin);
    writeFileSync(input, "fake wav"); writeFileSync(join(cache, "base.pt"), "cached");
    writeFileSync(mock, `#!/bin/sh
out=''; input="$1"; shift
while [ "$#" -gt 0 ]; do case "$1" in --output_dir) out="$2"; shift 2;; *) shift;; esac; done
printf '{"segments":[{"start":1,"end":1,"text":"bad"},{"start":1,"end":2,"text":"overlap"}]}' > "$out/$(basename "$input" .wav).json"
`); chmodSync(mock, 0o755);
    const result = spawnSync(python, [script, input, "--output", output], {
      encoding: "utf8", env: { ...process.env, PATH: `${bin}:/usr/bin:/bin`, XDG_CACHE_HOME: directory },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("invalid time bounds");
  });
});
