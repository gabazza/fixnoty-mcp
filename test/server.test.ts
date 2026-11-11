import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";

import { FixnotyApiError, type FixnotyClient } from "../src/client.ts";
import { createFixnotyServer } from "../src/server.ts";

const FEEDBACK_ID = "11111111-1111-4111-8111-111111111111";

const TOOL_NAMES = [
  "fixnoty_project",
  "fixnoty_list_feedback",
  "fixnoty_get_feedback",
  "fixnoty_feedback_assets",
  "fixnoty_feedback_replay",
];

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content.find((item) => item.type === "text");
  assert.ok(block?.text);
  return block.text;
}

async function connect(clientApi: FixnotyClient) {
  const server = createFixnotyServer(clientApi);
  const mcp = new Client({ name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await mcp.connect(clientTransport);
  return {
    mcp,
    async close() {
      await mcp.close();
      await server.close();
    },
  };
}

describe("MCP tools", () => {
  it("publishes five read-only tools and no write tools", async () => {
    const session = await connect({
      project: async () => ({}),
      listFeedback: async () => ({}),
      getFeedback: async () => ({}),
      assets: async () => ({}),
      replay: async () => ({}),
    });

    try {
      const listed = await session.mcp.listTools();
      const names = listed.tools.map((tool) => tool.name).sort();
      assert.deepEqual(names, [...TOOL_NAMES].sort());
      for (const tool of listed.tools) {
        assert.equal(tool.annotations?.readOnlyHint, true);
        assert.equal(tool.annotations?.destructiveHint, false);
      }
      const instructions = session.mcp.getInstructions();
      assert.match(instructions ?? "", /sola lettura/);
      assert.match(instructions ?? "", /aperto/);
    } finally {
      await session.close();
    }
  });

  it("lists open feedback and passes the filters through", async () => {
    let seen: unknown;
    const session = await connect({
      project: async () => {
        throw new Error("non chiamato");
      },
      listFeedback: async (query) => {
        seen = query;
        return { data: [], next_cursor: null, has_more: false };
      },
      getFeedback: async () => ({}),
      assets: async () => ({}),
      replay: async () => ({}),
    });

    try {
      const result = await session.mcp.callTool({
        name: "fixnoty_list_feedback",
        arguments: { status: "all", limit: 10, feedback_type: "request" },
      });
      assert.equal(result.isError, undefined);
      assert.deepEqual(seen, {
        status: "all",
        feedbackType: "request",
        updatedSince: undefined,
        limit: 10,
        cursor: undefined,
      });
      assert.match(textOf(result), /"has_more": false/);
    } finally {
      await session.close();
    }
  });

  it("rejects an id that is not a UUID before calling Fixnoty", async () => {
    let called = false;
    const session = await connect({
      project: async () => ({}),
      listFeedback: async () => ({}),
      getFeedback: async () => {
        called = true;
        return {};
      },
      assets: async () => ({}),
      replay: async () => ({}),
    });

    try {
      const result = await session.mcp.callTool({
        name: "fixnoty_get_feedback",
        arguments: { id: "../admin" },
      });
      assert.equal(result.isError, true);
      assert.equal(called, false);
    } finally {
      await session.close();
    }
  });

  it("returns the API plan error as a tool error", async () => {
    const session = await connect({
      project: async () => {
        throw new FixnotyApiError(
          "L’API è inclusa nei piani Pro e Agency.",
          403,
          "plan_required",
          null,
        );
      },
      listFeedback: async () => ({}),
      getFeedback: async () => ({}),
      assets: async () => ({}),
      replay: async () => ({}),
    });

    try {
      const result = await session.mcp.callTool({ name: "fixnoty_project" });
      assert.equal(result.isError, true);
      assert.match(textOf(result), /plan_required/);
      assert.match(textOf(result), /Agency/);
    } finally {
      await session.close();
    }
  });

  it("omits the replay timeline unless asked", async () => {
    const session = await connect({
      project: async () => ({}),
      listFeedback: async () => ({}),
      getFeedback: async () => ({}),
      assets: async () => ({}),
      replay: async () => ({
        feedback_id: FEEDBACK_ID,
        has_replay: true,
        formats: {
          player: { watch: { url: "https://www.fixnoty.com/it/replay/token" } },
        },
        timeline: [{ t: 1, type: "click" }, { t: 2, type: "scroll" }],
      }),
    });

    try {
      const hidden = await session.mcp.callTool({
        name: "fixnoty_feedback_replay",
        arguments: { id: FEEDBACK_ID },
      });
      const hiddenJson = JSON.parse(
        textOf(hidden).slice(textOf(hidden).indexOf("{")),
      ) as { timeline: unknown; timeline_omitted: boolean; timeline_event_count: number };
      assert.equal(hiddenJson.timeline, null);
      assert.equal(hiddenJson.timeline_omitted, true);
      assert.equal(hiddenJson.timeline_event_count, 2);
      assert.doesNotMatch(textOf(hidden), /"type": "click"/);

      const shown = await session.mcp.callTool({
        name: "fixnoty_feedback_replay",
        arguments: { id: FEEDBACK_ID, include_timeline: true },
      });
      assert.match(textOf(shown), /"type": "click"/);
    } finally {
      await session.close();
    }
  });
});
