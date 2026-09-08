/** Start an explicit local audio handoff; this does not execute a desktop program. */
export function downloadTranscriptionAudio(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  try { anchor.click(); }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
}
