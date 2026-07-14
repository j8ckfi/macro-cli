import assert from "node:assert/strict";
import test from "node:test";
import { directMcpRequest, shouldFallbackToSdk } from "../mcp.js";

const request = {
  url: "https://example.com/mcp",
  accessToken: "test-access",
  method: "tools/list",
  params: {},
};

test("direct MCP request sends one JSON-RPC POST and returns its result", async () => {
  let calls = 0;
  const result = await directMcpRequest({
    ...request,
    fetchImpl: async (url, init) => {
      calls += 1;
      const message = JSON.parse(init.body);
      assert.equal(url, request.url);
      assert.equal(init.method, "POST");
      assert.equal(init.headers.Authorization, "Bearer test-access");
      assert.equal(init.headers["MCP-Protocol-Version"], "2025-03-26");
      assert.equal(message.method, "tools/list");
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { tools: [] } }), {
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { tools: [] });
});

test("direct MCP request accepts a JSON-RPC event stream without retrying", async () => {
  let calls = 0;
  const result = await directMcpRequest({
    ...request,
    fetchImpl: async (_url, init) => {
      calls += 1;
      const { id } = JSON.parse(init.body);
      return new Response(`event: message\ndata: {"jsonrpc":"2.0","id":${id},"result":{"tools":[]}}\n\n`, {
        headers: { "Content-Type": "text/event-stream" },
      });
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { tools: [] });
});

test("only unambiguous protocol rejection is eligible for SDK fallback", async () => {
  const invoke = (body) => directMcpRequest({
    ...request,
    fetchImpl: async () => new Response(body, { status: 400 }),
  });

  await assert.rejects(invoke("bad request"), (error) => {
    assert.equal(shouldFallbackToSdk(error), false);
    return true;
  });
  await assert.rejects(invoke("initialize required"), (error) => {
    assert.equal(shouldFallbackToSdk(error), true);
    return true;
  });
});
