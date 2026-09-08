#!/usr/bin/env python3
"""Run the locally installed open-source Whisper CLI on one audio file.

This helper deliberately does not install packages or download models unless
the caller opts in with --allow-model-download.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import math
import re
from pathlib import Path


DEFAULT_MODEL = "base"
MODEL_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
MAX_JSON_BYTES = 20 * 1024 * 1024
MAX_SEGMENTS = 1_000
MAX_SECONDS = 24 * 60 * 60
MAX_TEXT_CHARS = 4_000
MAX_SERIALIZED_CHARS = 200_000


def model_cache_path(model: str) -> Path:
    cache_root = os.environ.get("XDG_CACHE_HOME")
    if cache_root:
        root = Path(cache_root) / "whisper"
    else:
        root = Path.home() / ".cache" / "whisper"
    return root / f"{model}.pt"


def valid_model(model: str) -> bool:
    return bool(MODEL_NAME.fullmatch(model)) and ".." not in model


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Transcribe one local audio file with the installed open-source Whisper CLI."
    )
    p.add_argument("audio", nargs="?", type=Path, help="local audio file (for example, a trimmed 16 kHz WAV)")
    p.add_argument("--output", "-o", type=Path, help="required destination JSON path")
    p.add_argument("--model", default=DEFAULT_MODEL, help=f"Whisper model name (default: {DEFAULT_MODEL})")
    p.add_argument("--language", help="optional language code, such as en")
    p.add_argument("--allow-model-download", action="store_true", help="explicitly allow Whisper to download a missing model")
    p.add_argument("--overwrite", action="store_true", help="replace an existing output JSON file")
    p.add_argument("--check", action="store_true", help="report CLI availability and (when --model is supplied) cache status")
    return p


def check(args: argparse.Namespace) -> int:
    if not valid_model(args.model):
        print(json.dumps({"error": "model name contains unsafe characters"}))
        return 2
    executable = shutil.which("whisper")
    result: dict[str, object] = {
        "whisperInstalled": executable is not None,
        "whisperPath": executable,
    }
    # A cache hit is useful information, but is intentionally never inferred
    # from executable availability. The model is ready only when this exists.
    cache = model_cache_path(args.model)
    result["model"] = args.model
    result["modelCached"] = cache.is_file()
    result["modelCachePath"] = str(cache)
    default_cache = model_cache_path(DEFAULT_MODEL)
    result["defaultModelCached"] = default_cache.is_file()
    result["defaultModelCachePath"] = str(default_cache)
    print(json.dumps(result, sort_keys=True))
    return 0


def fail(message: str) -> int:
    print(f"transcribe-local: {message}", file=sys.stderr)
    return 1


def run(args: argparse.Namespace) -> int:
    if args.audio is None:
        return fail("an audio input path is required")
    if args.output is None:
        return fail("--output is required")
    args.audio = args.audio.expanduser().resolve()
    args.output = args.output.expanduser().resolve()
    if args.audio == args.output:
        return fail("output path must differ from the source audio path")
    if not args.audio.is_file():
        return fail(f"audio file does not exist or is not a regular file: {args.audio}")
    if args.output.exists() and not args.overwrite:
        return fail(f"output already exists (pass --overwrite to replace it): {args.output}")
    if not args.output.parent.is_dir():
        return fail(f"output directory does not exist: {args.output.parent}")

    executable = shutil.which("whisper")
    if executable is None:
        return fail("Whisper CLI is not installed or not on PATH; install it explicitly, then retry")

    if not valid_model(args.model):
        return fail("model name contains unsafe characters")
    cache = model_cache_path(args.model)
    cached = cache.is_file()
    if not cached and not args.allow_model_download:
        return fail(
            f"Whisper model '{args.model}' is not present at {model_cache_path(args.model)}; "
            "pass --allow-model-download explicitly if downloading is intended"
        )

    with tempfile.TemporaryDirectory(prefix="inkframe-whisper-") as directory:
        # A cache path is used in offline mode: passing a model name allows
        # Whisper to re-download/revalidate it unexpectedly.
        model_argument = str(cache) if cached and not args.allow_model_download else args.model
        command = [executable, str(args.audio), "--model", model_argument, "--output_format", "json", "--output_dir", directory]
        if args.allow_model_download:
            command.extend(["--model_dir", str(cache.parent)])
        if args.language:
            command.extend(["--language", args.language])
        try:
            completed = subprocess.run(command, capture_output=True, text=True, check=False, timeout=30 * 60)
        except subprocess.TimeoutExpired:
            return fail("Whisper timed out after 30 minutes")
        except OSError as error:
            return fail(f"could not start Whisper: {error}")
        if completed.returncode != 0:
            details = (completed.stderr or completed.stdout).strip()
            return fail(f"Whisper failed with exit code {completed.returncode}: {details or 'no diagnostic output'}")

        generated = Path(directory) / f"{args.audio.stem}.json"
        if not generated.is_file():
            return fail(f"Whisper completed but did not produce expected JSON: {generated.name}")
        try:
            if generated.stat().st_size > MAX_JSON_BYTES:
                return fail("Whisper output exceeds the 20 MiB safety limit")
            payload = json.loads(generated.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            return fail(f"Whisper output is not valid JSON: {error}")
        segments = payload.get("segments") if isinstance(payload, dict) else None
        if not isinstance(segments, list) or not segments or len(segments) > MAX_SEGMENTS:
            return fail("Whisper JSON must contain a bounded segments array")
        compact_segments: list[dict[str, object]] = []
        previous_end = 0.0
        for index, segment in enumerate(segments):
            if (not isinstance(segment, dict) or not isinstance(segment.get("text"), str)
                    or not segment["text"].strip() or len(segment["text"]) > MAX_TEXT_CHARS):
                return fail(f"Whisper JSON segment {index} has nonempty text requirement")
            start, end = segment.get("start"), segment.get("end")
            if (isinstance(start, bool) or not isinstance(start, (int, float)) or not math.isfinite(start)
                    or isinstance(end, bool) or not isinstance(end, (int, float)) or not math.isfinite(end)
                    or start < previous_end or end <= start or end > MAX_SECONDS):
                return fail(f"Whisper JSON segment {index} has invalid time bounds")
            compact_segments.append({"start": start, "end": end, "text": segment["text"]})
            previous_end = float(end)
        payload = {"segments": compact_segments}
        serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        if len(serialized) > MAX_SERIALIZED_CHARS:
            return fail("compact transcript JSON exceeds the 200,000 character safety limit")

        # Same-directory temporary file + replace gives readers an all-or-
        # nothing output, including when --overwrite was explicitly requested.
        temporary: Path | None = None
        try:
            fd, temporary_name = tempfile.mkstemp(prefix=f".{args.output.name}.", suffix=".tmp", dir=args.output.parent)
            temporary = Path(temporary_name)
            with os.fdopen(fd, "w", encoding="utf-8") as stream:
                stream.write(serialized)
                stream.write("\n")
                stream.flush()
                os.fsync(stream.fileno())
            if args.overwrite:
                os.replace(temporary, args.output)
            else:
                # link() is atomic and fails if another writer created output
                # after our initial existence check (TOCTOU-safe no-overwrite).
                os.link(temporary, args.output)
                temporary.unlink()
                temporary = None
        except OSError as error:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
            return fail(f"could not write output JSON: {error}")
    return 0


def main() -> int:
    args = parser().parse_args()
    return check(args) if args.check else run(args)


if __name__ == "__main__":
    raise SystemExit(main())
