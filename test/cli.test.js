import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

const cli = new URL("../index.js", import.meta.url).pathname;

function run(args, env = {}, input) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function jsonRpc(id, result) {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

async function mockMacro() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/register") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({
        client_id: "test-client",
        client_name: "Macro CLI for Pi",
        redirect_uris: ["http://127.0.0.1/callback"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      }));
      return;
    }
    if (url.pathname === "/authorize") {
      const redirect = new URL(url.searchParams.get("redirect_uri"));
      redirect.searchParams.set("code", "test-code");
      redirect.searchParams.set("state", url.searchParams.get("state"));
      response.writeHead(302, { location: redirect.href }).end();
      return;
    }
    if (url.pathname === "/token") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ access_token: "test-access", refresh_token: "test-refresh", token_type: "Bearer" }));
      return;
    }
    if (url.pathname !== "/mcp") {
      response.writeHead(404).end();
      return;
    }
    if (request.headers.authorization !== "Bearer test-access") {
      response.writeHead(401).end();
      return;
    }
    if (request.method === "GET") {
      response.writeHead(405).end();
      return;
    }
    if (request.method === "DELETE") {
      response.writeHead(200).end();
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const message = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!Object.hasOwn(message, "id")) {
      response.writeHead(202).end();
      return;
    }
    response.setHeader("content-type", "application/json");
    if (message.method === "initialize") {
      response.end(jsonRpc(message.id, {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "mock-macro", version: "1.0.0" },
      }));
      return;
    }
    if (message.method === "tools/list") {
      response.end(jsonRpc(message.id, { tools: [{
        name: "ContentSearch",
        description: "Search content",
        inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      }] }));
      return;
    }
    if (message.method === "tools/call") {
      response.end(jsonRpc(message.id, {
        content: [{ type: "text", text: "ok" }],
        structuredContent: { tool: message.params.name, arguments: message.params.arguments },
      }));
      return;
    }
    response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "not found" } }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

test("help and unauthenticated status", async () => {
  const config = await mkdtemp(join(tmpdir(), "macro-cli-test-"));
  try {
    const help = await run(["--help"], { MACRO_CLI_CONFIG_DIR: config });
    assert.equal(help.code, 0);
    assert.match(help.stdout, /macro call <tool>/);
    const status = await run(["status", "--json"], { MACRO_CLI_CONFIG_DIR: config });
    assert.equal(status.code, 0);
    assert.equal(JSON.parse(status.stdout).authenticated, false);
  } finally {
    await rm(config, { recursive: true, force: true });
  }
});

test("OAuth login, discovery, and tool calls", async () => {
  const config = await mkdtemp(join(tmpdir(), "macro-cli-test-"));
  const mock = await mockMacro();
  const env = { MACRO_CLI_CONFIG_DIR: config, MACRO_MCP_URL: `${mock.origin}/mcp` };
  try {
    const child = spawn(process.execPath, [cli, "login", "--no-open"], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", async (chunk) => {
      stderr += chunk;
      const match = stderr.match(/(http:\/\/127\.0\.0\.1:\d+\/authorize\?[^\s]+)/);
      if (match && !stderr.includes("[followed]")) {
        stderr += "[followed]";
        await fetch(match[1]);
      }
    });
    const [code] = await once(child, "close");
    assert.equal(code, 0, stderr);
    assert.match(stdout, /Signed in/);

    const credentials = JSON.parse(await readFile(join(config, "credentials.json"), "utf8"));
    assert.equal(credentials.tokens.access_token, "test-access");
    assert.equal((await stat(join(config, "credentials.json"))).mode & 0o777, 0o600);

    const tools = await run(["tools"], env);
    assert.equal(tools.code, 0, tools.stderr);
    assert.match(tools.stdout, /^ContentSearch\tSearch content/m);

    const call = await run(["call", "ContentSearch", '{"query":"roadmap"}'], env);
    assert.equal(call.code, 0, call.stderr);
    assert.deepEqual(JSON.parse(call.stdout), { tool: "ContentSearch", arguments: { query: "roadmap" } });

    const search = await run(["search", "roadmap", "--type", "documents", "--exact"], env);
    assert.equal(search.code, 0, search.stderr);
    assert.deepEqual(JSON.parse(search.stdout).arguments, {
      query: "roadmap",
      matchType: "exact",
      entityTypes: ["documents"],
    });
  } finally {
    mock.server.close();
    await rm(config, { recursive: true, force: true });
  }
});
