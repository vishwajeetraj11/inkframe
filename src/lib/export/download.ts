export interface ExportDownloadPayload {
  downloadUrl: string;
  filename: string;
}

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
