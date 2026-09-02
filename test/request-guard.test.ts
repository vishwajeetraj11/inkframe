import { afterEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  readJsonBody,
  RequestBodyError,
  resetRequestGuardsForTests,
} from "@/server/request-guard";

afterEach(() => resetRequestGuardsForTests());

describe("request guards", () => {
  it("rate limits a route bucket per client and returns retry guidance", async () => {
    const request = () => new Request("https://inkframe.test/api/example", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });
    expect(checkRateLimit(request(), { bucket: "test", limit: 2, windowMs: 60_000 }).ok).toBe(true);
    expect(checkRateLimit(request(), { bucket: "test", limit: 2, windowMs: 60_000 }).ok).toBe(true);
    const blocked = checkRateLimit(request(), { bucket: "test", limit: 2, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.response.status).toBe(429);
    expect(blocked.response.headers.get("retry-after")).toBeTruthy();
    expect(blocked.response.headers.get("ratelimit-remaining")).toBe("0");
    expect(await blocked.response.json()).toEqual({ error: "Too many requests. Try again shortly." });
  });

  it("parses bounded JSON and rejects oversized bodies", async () => {
    await expect(readJsonBody<{ ok: boolean }>(new Request("https://inkframe.test/api/example", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    }), 64)).resolves.toEqual({ ok: true });

    await expect(readJsonBody(new Request("https://inkframe.test/api/example", {
      method: "POST",
      body: JSON.stringify({ text: "a".repeat(128) }),
    }), 32)).rejects.toMatchObject({ status: 413, name: "RequestBodyError" } satisfies Partial<RequestBodyError>);
  });
});
