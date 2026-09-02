import { request as httpsRequest } from "node:https";

/**
 * Node's happy-eyeballs connection can stall on some local networks even when
 * the Pexels IPv4 endpoint is healthy. Keep this transport server-only and pin
 * the request family without exposing the API key to the browser.
 */
export const fetchPexelsOverIpv4: typeof fetch = async (input, init = {}) => {
  const url = input instanceof Request
    ? new URL(input.url)
    : input instanceof URL
      ? input
      : new URL(input);

  if (url.protocol !== "https:") {
    throw new TypeError("Pexels requests must use HTTPS.");
  }

  return new Promise<Response>((resolve, reject) => {
    const signal = init.signal ?? (input instanceof Request ? input.signal : undefined);
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));

    const request = httpsRequest(url, {
      method: init.method ?? (input instanceof Request ? input.method : "GET"),
      family: 4,
      headers: Object.fromEntries(headers.entries()),
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer | Uint8Array | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on("end", () => {
        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) {
            value.forEach((entry) => responseHeaders.append(key, entry));
          } else if (value !== undefined) {
            responseHeaders.set(key, String(value));
          }
        }
        resolve(new Response(Buffer.concat(chunks), {
          status: response.statusCode ?? 502,
          statusText: response.statusMessage,
          headers: responseHeaders,
        }));
      });
    });

    const abort = () => request.destroy(new DOMException("Request aborted", "AbortError"));
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    request.setTimeout(15_000, () => request.destroy(new Error("Pexels request timed out")));
    request.on("error", reject);
    request.on("close", () => signal?.removeEventListener("abort", abort));
    request.end();
  });
};
