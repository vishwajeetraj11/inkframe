export const jsonError = (message: string, status: number): Response =>
  Response.json(
    {
      error: message,
    },
    {
      status,
    },
  );

export const getErrorMessage = (
  error: unknown,
  fallback: string,
): string => (error instanceof Error ? error.message : fallback);
