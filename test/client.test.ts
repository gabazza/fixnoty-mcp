import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FixnotyApiError, createClient } from "../src/client.ts";
import type { FetchLike } from "../src/client.ts";

const KEY = `fn_live_${"ab".repeat(32)}`;
const CONFIG = { apiKey: KEY, baseUrl: "https://www.fixnoty.com" };

function jsonResponse(status: number, body: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("createClient", () => {
  it("sends the key as a bearer header and never in the URL", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, { project: { id: "p1", name: "Sito", site_url: "https://example.com" } });
    };

    const client = createClient(CONFIG, fetchImpl);
    const body = await client.listFeedback({
      status: "open",
      feedbackType: "visual",
      updatedSince: "2026-10-01T00:00:00.000Z",
      limit: 20,
      cursor: "cursor-1",
    });

    assert.equal(calls.length, 1);
    const url = new URL(calls[0].url);
    assert.equal(url.origin, "https://www.fixnoty.com");
    assert.equal(url.pathname, "/api/v1/feedback");
    assert.equal(url.searchParams.get("status"), "open");
    assert.equal(url.searchParams.get("feedback_type"), "visual");
    assert.equal(url.searchParams.get("limit"), "20");
    assert.equal(url.searchParams.get("cursor"), "cursor-1");
    assert.equal(url.searchParams.get("api_key"), null);
    assert.equal(url.search.includes(KEY), false);

    const headers = new Headers(calls[0].init?.headers);
    assert.equal(headers.get("authorization"), `Bearer ${KEY}`);
    assert.equal(calls[0].init?.method, "GET");
    assert.equal(calls[0].init?.redirect, "manual");
    assert.ok(body);
  });

  it("encodes the feedback id in the path", async () => {
    let seen = "";
    const fetchImpl: FetchLike = async (url) => {
      seen = url;
      return jsonResponse(200, { id: "ok" });
    };
    const client = createClient(CONFIG, fetchImpl);
    await client.getFeedback("11111111-1111-4111-8111-111111111111", true);
    const url = new URL(seen);
    assert.equal(
      url.pathname,
      "/api/v1/feedback/11111111-1111-4111-8111-111111111111",
    );
    assert.equal(url.searchParams.get("include"), "recording_events");
  });

  it("surfaces the API error code and Retry-After", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(
        429,
        { error: "Troppe richieste.", code: "rate_limited" },
        { "retry-after": "12" },
      );
    const client = createClient(CONFIG, fetchImpl);
    await assert.rejects(
      () => client.project(),
      (error: unknown) => {
        assert.ok(error instanceof FixnotyApiError);
        assert.equal(error.code, "rate_limited");
        assert.equal(error.status, 429);
        assert.equal(error.retryAfter, "12");
        assert.equal(error.message, "Troppe richieste.");
        return true;
      },
    );
  });

  it("does not follow a redirect", async () => {
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls += 1;
      return new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/steal" },
      });
    };
    const client = createClient(CONFIG, fetchImpl);
    await assert.rejects(() => client.assets("abc"), /redirect/);
    assert.equal(calls, 1);
  });
});
