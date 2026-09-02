interface RateLimitOptions {
  bucket: string;
  limit: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export type RateLimitResult =
  | { ok: true; headers: HeadersInit }
  | { ok: false; response: Response };

const rateLimits = new Map<string, RateLimitEntry>();
const MAX_RATE_LIMIT_ENTRIES = 5_000;

const clientId = (request: Request): string =>
  request.headers.get("cf-connecting-ip")?.trim() ||
  request.headers.get("x-real-ip")?.trim() ||
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  "local";

const pruneRateLimits = (now: number): void => {
  if (rateLimits.size < MAX_RATE_LIMIT_ENTRIES) return;
  for (const [key, entry] of rateLimits) {
    if (entry.resetAt <= now) rateLimits.delete(key);
  }
  while (rateLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
    const oldestKey = rateLimits.keys().next().value;
    if (typeof oldestKey !== "string") break;
    rateLimits.delete(oldestKey);
  }
};

export const checkRateLimit = (
  request: Request,
  { bucket, limit, windowMs }: RateLimitOptions,
): RateLimitResult => {
  const now = Date.now();
  pruneRateLimits(now);
  const key = `${bucket}:${clientId(request)}`;
  const existing = rateLimits.get(key);
  const entry = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : existing;
  entry.count += 1;
  rateLimits.set(key, entry);

  const remaining = Math.max(0, limit - entry.count);
  const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1_000));
  const headers = {
    "RateLimit-Limit": String(limit),
    "RateLimit-Remaining": String(remaining),
    "RateLimit-Reset": String(Math.ceil(entry.resetAt / 1_000)),
  };
  if (entry.count <= limit) return { ok: true, headers };

  return {
    ok: false,
    response: Response.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { ...headers, "Retry-After": String(retryAfter) } },
    ),
  };
};

export class RequestBodyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RequestBodyError";
  }
}

export const readJsonBody = async <T = unknown>(
  request: Request,
  maxBytes: number,
): Promise<T> => {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyError(`Request body exceeds ${maxBytes} bytes.`, 413);
  }
  if (!request.body) throw new RequestBodyError("Request body is required.", 400);

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new RequestBodyError(`Request body exceeds ${maxBytes} bytes.`, 413);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new RequestBodyError("Request body must be valid JSON.", 400);
  }
};

export const resetRequestGuardsForTests = (): void => {
  if (process.env.NODE_ENV === "test") rateLimits.clear();
};
