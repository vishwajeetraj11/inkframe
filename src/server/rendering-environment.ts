export const shouldUseVercelSandboxRender = (): boolean =>
  Boolean(process.env.VERCEL?.trim()) && process.env.NODE_ENV === "production";

export const getVercelBlobToken = (): string => {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    throw new Error(
      "Missing BLOB_READ_WRITE_TOKEN environment variable for Vercel exports.",
    );
  }

  return token;
};
