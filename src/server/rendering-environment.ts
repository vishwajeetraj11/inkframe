export const shouldUseVercelSandboxRender = (): boolean =>
  Boolean(process.env.VERCEL?.trim()) && process.env.NODE_ENV === "production";

export const getVercelBlobToken = (): string => {
  const token =
    process.env.new_READ_WRITE_TOKEN?.trim() ||
    process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    throw new Error(
      "Missing new_READ_WRITE_TOKEN environment variable. Attach a Vercel Blob store to this project, or add the token manually before using exports.",
    );
  }

  return token;
};
