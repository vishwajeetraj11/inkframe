export interface ExportDownloadPayload {
  downloadUrl: string;
  filename: string;
}

export interface BrowserBlobDownload {
  blob: Blob;
  filename: string;
}

export interface BrowserTextDownload {
  contents: string;
  filename: string;
  mimeType: string;
}

export const getFilenameFromContentDisposition = (
  contentDisposition: string | null,
): string | null => {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const plainMatch = contentDisposition.match(/filename=([^;]+)/i);
  return plainMatch?.[1]?.trim() ?? null;
};

export const isExportDownloadPayload = (
  value: unknown,
): value is ExportDownloadPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ExportDownloadPayload>;

  return (
    typeof candidate.downloadUrl === "string" &&
    typeof candidate.filename === "string"
  );
};

export const triggerBrowserDownload = ({
  url,
  filename,
}: {
  url: string;
  filename: string;
}): void => {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
};

/** Download generated browser content without leaking its temporary object URL. */
export const triggerBrowserBlobDownload = ({
  blob,
  filename,
}: BrowserBlobDownload): void => {
  const url = URL.createObjectURL(blob);
  triggerBrowserDownload({ url, filename });
  // Let the browser consume the click before releasing the object URL. Immediate
  // revocation can cancel downloads in Safari and Firefox.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

/** Download a generated text interchange file such as FCPXML or CMX 3600 EDL. */
export const triggerBrowserTextDownload = ({
  contents,
  filename,
  mimeType,
}: BrowserTextDownload): void => {
  triggerBrowserBlobDownload({
    blob: new Blob([contents], { type: mimeType }),
    filename,
  });
};
