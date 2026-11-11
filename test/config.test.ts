import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_BASE_URL, readConfig } from "../src/config.ts";

const LIVE_KEY = `fn_live_${"ab".repeat(32)}`;
const TEST_KEY = `fn_test_${"cd".repeat(32)}`;

describe("readConfig", () => {
  it("uses production when the base URL is omitted", () => {
    const config = readConfig({ FIXNOTY_API_KEY: LIVE_KEY });
    assert.equal(config.apiKey, LIVE_KEY);
    assert.equal(config.baseUrl, DEFAULT_BASE_URL);
  });

  it("accepts a test key and a local http origin", () => {
    const config = readConfig({
      FIXNOTY_API_KEY: TEST_KEY,
      FIXNOTY_API_BASE_URL: "http://127.0.0.1:3000/api/v1?x=1",
    });
    assert.equal(config.baseUrl, "http://127.0.0.1:3000");
  });

  it("drops the path and keeps only the origin", () => {
    const config = readConfig({
      FIXNOTY_API_KEY: LIVE_KEY,
      FIXNOTY_API_BASE_URL: "https://www.fixnoty.com/it/docs/api",
    });
    assert.equal(config.baseUrl, "https://www.fixnoty.com");
  });

  it("rejects a missing or short key", () => {
    assert.throws(() => readConfig({}), /FIXNOTY_API_KEY/);
    assert.throws(() => readConfig({ FIXNOTY_API_KEY: "fn_live_abc" }), /FIXNOTY_API_KEY/);
  });

  it("rejects cleartext on a public host", () => {
    assert.throws(
      () =>
        readConfig({
          FIXNOTY_API_KEY: LIVE_KEY,
          FIXNOTY_API_BASE_URL: "http://www.fixnoty.com",
        }),
      /localhost/,
    );
  });

  it("rejects credentials in the base URL", () => {
    assert.throws(
      () =>
        readConfig({
          FIXNOTY_API_KEY: LIVE_KEY,
          FIXNOTY_API_BASE_URL: "https://user:secret@www.fixnoty.com",
        }),
      /password/,
    );
  });
});
