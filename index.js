#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join } from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { compactToolOutput } from "./format.js";

const VERSION = "1.0.0";
const MCP_URL = process.env.MACRO_MCP_URL || "https://mcp-server.macro.com/mcp";
const AUTH_BASE = new URL(MCP_URL).origin;
const CONFIG_DIR = process.env.MACRO_CLI_CONFIG_DIR || join(homedir(), ".config", "macro-cli");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");

const TAG_SPECS = {
  "--tag": "repeat",
  "--tags-match": "value",
};

function normalizedEndpoint(value) {
  const url = new URL(value);
  url.hash = "";
  return url.href.replace(/\/$/, "");
}

function assertCredentialEndpoint(credentials) {
  if (!credentials?.endpoint) {
    fail("Credentials do not record their MCP endpoint. Run: macro login", 2);
  }
  if (normalizedEndpoint(credentials.endpoint) !== normalizedEndpoint(MCP_URL)) {
    fail(
      `Credentials belong to ${credentials.endpoint}, not ${MCP_URL}. `
      + "Use a separate MACRO_CLI_CONFIG_DIR or run macro login for this endpoint.",
      2,
    );
  }
}

const HELP = `macro ${VERSION} — CLI for the Macro workspace MCP server

Usage:
  macro login [--no-open]                    Sign in through Macro OAuth
  macro logout                               Remove local credentials
  macro status [--json]                      Show authentication/server status
  macro tools [--json]                       List live MCP tools
  macro schema <tool> [--json]               Show one live tool schema
  macro call <tool> [JSON|@file|-] [--json]  Call any MCP tool

Convenience commands:
  macro search <query> [options]              Search workspace content
  macro recent [options]                     Browse recent workspace items
  macro read <document-id> [--metadata]       Read a document
  macro create <name> [options]               Create a document or task

Search options:
  --name                 Search names/titles instead of content
  --exact                Match exact tokens instead of prefixes
  --type <type>          Restrict entity type (repeatable)
  --inbox <email>        Restrict email results to one inbox
  --tag <label>          Restrict by tag (repeatable)
  --tags-match any|all   How multiple tags combine
  --limit <number>       Return at most this many compact results (default: 10)
  --all                  Return every compact result

Recent options:
  --type <type>          Restrict item type (repeatable)
  --sort <order>         recently_updated (default), recently_created, recently_viewed
  --signal               Restrict to Signal email
  --inbox <email>        Restrict email results to one inbox
  --tag <label>          Restrict by tag (repeatable)
  --tags-match any|all   How multiple tags combine

Create options:
  --file <path>          Read document content from a file
  --content <text>       Use literal content (default: read stdin)
  --ext <extension>      File extension (default: inferred, then md)
  --task                 Create a Macro task (requires md)

JSON input may be literal JSON, @path, or - for stdin. Output is compact,
agent-oriented JSON by default; --json emits the complete MCP response. Credentials
are stored mode 0600 in:
  ${CREDENTIALS_PATH}
`;

function base64url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function fail(message, code = 1) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

async function readCredentials() {
  try {
    return JSON.parse(await readFile(CREDENTIALS_PATH, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    fail(`Could not read ${CREDENTIALS_PATH}: ${error.message}`);
  }
}

async function saveCredentials(credentials) {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await chmod(CONFIG_DIR, 0o700);
  const temporary = `${CREDENTIALS_PATH}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, CREDENTIALS_PATH);
  await chmod(CREDENTIALS_PATH, 0o600);
}

async function fetchJson(url, init, context) {
  const response = await fetch(url, init);
  const body = await response.text();
  let parsed;
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    parsed = undefined;
  }
  if (!response.ok) {
    const detail = parsed?.error_description || parsed?.error || body || response.statusText;
    fail(`${context} failed (HTTP ${response.status}): ${detail}`);
  }
  if (parsed === undefined) fail(`${context} returned invalid JSON`);
  return parsed;
}

function openBrowser(url) {
  let command;
  let args;
  if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else if (process.platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else {
    command = "xdg-open";
    args = [url];
  }
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

async function listenForOAuthCallback(state) {
  let settle;
  let settled = false;
  const result = new Promise((resolve, reject) => {
    settle = { resolve, reject };
  });

  function finish(response, { status, body, error, code } = {}) {
    if (settled) {
      response.writeHead(409).end("Already completed");
      return;
    }
    settled = true;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.writeHead(status).end(body);
    if (error) settle.reject(error instanceof Error ? error : new Error(String(error)));
    else settle.resolve(code);
  }

  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname !== "/callback") {
      response.writeHead(404).end("Not found");
      return;
    }
    if (url.searchParams.get("state") !== state) {
      finish(response, {
        status: 400,
        body: "<h1>Macro CLI sign-in failed</h1><p>OAuth state did not match.</p>",
        error: "OAuth state did not match",
      });
      return;
    }
    const oauthError = url.searchParams.get("error");
    if (oauthError) {
      finish(response, {
        status: 400,
        body: "<h1>Macro CLI sign-in was not completed</h1><p>You may close this tab.</p>",
        error: url.searchParams.get("error_description") || oauthError,
      });
      return;
    }
    const code = url.searchParams.get("code");
    if (!code) {
      finish(response, {
        status: 400,
        body: "<h1>Macro CLI sign-in failed</h1><p>No authorization code was returned.</p>",
        error: "No authorization code was returned",
      });
      return;
    }
    finish(response, {
      status: 200,
      body: "<h1>Macro CLI is connected</h1><p>You may close this tab and return to your terminal.</p>",
      code,
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const redirectUri = `http://127.0.0.1:${address.port}/callback`;
  return { server, result, redirectUri };
}

async function login({ noOpen = false } = {}) {
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(24));
  const callback = await listenForOAuthCallback(state);
  let timeout;
  try {
    const client = await fetchJson(
      `${AUTH_BASE}/register`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Macro CLI for Pi",
          redirect_uris: [callback.redirectUri],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        }),
      },
      "OAuth client registration",
    );

    const authorize = new URL(`${AUTH_BASE}/authorize`);
    authorize.search = new URLSearchParams({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: callback.redirectUri,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();

    console.error("Open this URL to sign in to Macro:\n");
    console.error(`${authorize}\n`);
    if (!noOpen && openBrowser(authorize.href)) console.error("Opened your browser. Waiting for authorization…");
    else console.error("Waiting for authorization…");

    const timedResult = new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error("Timed out waiting for OAuth authorization")), 5 * 60_000);
    });
    const code = await Promise.race([callback.result, timedResult]);
    const tokens = await fetchJson(
      `${AUTH_BASE}/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: callback.redirectUri,
          client_id: client.client_id,
        }),
      },
      "OAuth token exchange",
    );
    await saveCredentials({ endpoint: MCP_URL, client, tokens, updatedAt: new Date().toISOString() });
    console.log("Signed in to Macro.");
  } finally {
    clearTimeout(timeout);
    callback.server.close();
  }
}

async function refreshCredentials(credentials) {
  const refreshToken = credentials?.tokens?.refresh_token;
  if (!refreshToken) fail("Macro credentials have expired. Run: macro login", 2);
  const clientId = credentials.client?.client_id;
  if (!clientId) fail("Macro credentials are incomplete. Run: macro login", 2);
  const tokens = await fetchJson(
    `${AUTH_BASE}/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    },
    "OAuth token refresh",
  );
  const updated = { ...credentials, endpoint: MCP_URL, tokens, updatedAt: new Date().toISOString() };
  await saveCredentials(updated);
  return updated;
}

function isUnauthorized(error) {
  return error?.code === 401 || /\b401\b|unauthori[sz]ed|invalid_token/i.test(error?.message || "");
}

async function connectWith(credentials) {
  const accessToken = credentials?.tokens?.access_token;
  if (!accessToken) fail("Not signed in to Macro. Run: macro login", 2);
  const client = new Client({ name: "macro-cli", version: VERSION }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  await client.connect(transport);
  return client;
}

async function withClient(operation) {
  let credentials = await readCredentials();
  if (!credentials) fail("Not signed in to Macro. Run: macro login", 2);
  assertCredentialEndpoint(credentials);
  let client;
  try {
    try {
      client = await connectWith(credentials);
      return await operation(client);
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
      if (client) await client.close().catch(() => {});
      credentials = await refreshCredentials(credentials);
      client = await connectWith(credentials);
      return await operation(client);
    }
  } finally {
    if (client) await client.close().catch(() => {});
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function parseJsonInput(value) {
  let source;
  if (!value) return {};
  if (value === "-") source = await readStdin();
  else if (value.startsWith("@")) source = await readFile(value.slice(1), "utf8");
  else source = value;
  try {
    const parsed = JSON.parse(source);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") fail("Tool arguments must be a JSON object");
    return parsed;
  } catch (error) {
    if (error.exitCode) throw error;
    fail(`Invalid JSON arguments: ${error.message}`);
  }
}

function print(value, fullJson = false, toolName, formatOptions) {
  if (fullJson || value === undefined || typeof value !== "object") {
    console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
    return;
  }
  if (value.structuredContent !== undefined) {
    const output = compactToolOutput(toolName, value.structuredContent, formatOptions);
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  if (Array.isArray(value.content)) {
    const text = value.content
      .map((item) => {
        if (item.type === "text") return item.text;
        if (item.type === "resource_link") return `${item.name || "resource"}: ${item.uri}`;
        return JSON.stringify(item);
      })
      .join("\n");
    if (text) console.log(text);
    else console.log(JSON.stringify(value, null, 2));
    return;
  }
  console.log(JSON.stringify(value, null, 2));
}

function takeOptions(args, specs) {
  const positional = [];
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const spec = specs[arg];
    if (!spec) {
      if (arg.startsWith("--")) fail(`Unknown option: ${arg}`);
      positional.push(arg);
      continue;
    }
    if (spec === "boolean") options[arg.slice(2)] = true;
    else {
      const value = args[++index];
      if (value === undefined) fail(`${arg} requires a value`);
      const key = arg.slice(2);
      if (spec === "repeat") (options[key] ||= []).push(value);
      else options[key] = value;
    }
  }
  return { positional, options };
}

function peelGlobals(args) {
  const remaining = [];
  let json = false;
  for (const arg of args) {
    if (arg === "--json") json = true;
    else remaining.push(arg);
  }
  return { args: remaining, json };
}

function tagFilters(labels = []) {
  return labels.map((label) => ({ label }));
}

function applyTagOptions(input, options) {
  if (options["tags-match"] && !["any", "all"].includes(options["tags-match"])) {
    fail("--tags-match must be any or all");
  }
  if (options.tag) input.tags = tagFilters(options.tag);
  if (options["tags-match"]) input.tagsMatch = options["tags-match"];
  return input;
}

async function callTool(name, arguments_, fullJson, formatOptions) {
  const result = await withClient((client) => client.callTool({ name, arguments: arguments_ }));
  print(result, fullJson, name, formatOptions);
  if (result.isError) process.exitCode = 3;
  return result;
}

const COMMANDS = {
  login: {
    specs: { "--no-open": "boolean" },
    async run({ positional, options }) {
      if (positional.length) fail("Usage: macro login [--no-open]");
      await login({ noOpen: options["no-open"] });
    },
  },
  logout: {
    async run({ positional }) {
      if (positional.length) fail("Usage: macro logout");
      await rm(CREDENTIALS_PATH, { force: true });
      console.log("Signed out of Macro.");
    },
  },
  status: {
    async run({ positional, fullJson }) {
      if (positional.length) fail("Usage: macro status [--json]");
      const credentials = await readCredentials();
      if (!credentials) {
        print({ authenticated: false, endpoint: MCP_URL }, fullJson);
        return;
      }
      try {
        const info = await withClient(async (client) => ({
          authenticated: true,
          endpoint: MCP_URL,
          server: client.getServerVersion(),
          capabilities: client.getServerCapabilities(),
        }));
        print(info, fullJson);
      } catch (error) {
        if (isUnauthorized(error)) print({ authenticated: false, endpoint: MCP_URL }, fullJson);
        else throw error;
      }
    },
  },
  tools: {
    async run({ positional, fullJson }) {
      if (positional.length) fail("Usage: macro tools [--json]");
      const result = await withClient((client) => client.listTools());
      if (fullJson) print(result, true);
      else {
        for (const tool of result.tools) console.log(`${tool.name}\t${tool.description || ""}`);
      }
    },
  },
  schema: {
    async run({ positional }) {
      if (positional.length !== 1) fail("Usage: macro schema <tool> [--json]");
      const result = await withClient((client) => client.listTools());
      const tool = result.tools.find((candidate) => candidate.name === positional[0]);
      if (!tool) fail(`Unknown live Macro tool: ${positional[0]}`);
      print(tool, true);
    },
  },
  call: {
    async run({ positional, fullJson }) {
      if (positional.length < 1 || positional.length > 2) {
        fail("Usage: macro call <tool> [JSON|@file|-] [--json]");
      }
      await callTool(positional[0], await parseJsonInput(positional[1]), fullJson);
    },
  },
  search: {
    specs: {
      "--name": "boolean",
      "--exact": "boolean",
      "--type": "repeat",
      "--inbox": "value",
      ...TAG_SPECS,
      "--limit": "value",
      "--all": "boolean",
    },
    async run({ positional, options, fullJson }) {
      if (positional.length !== 1) fail("Usage: macro search <query> [options]");
      const limit = options.all ? Number.POSITIVE_INFINITY : Number(options.limit || 10);
      if (!options.all && (!Number.isInteger(limit) || limit < 1)) fail("--limit must be a positive integer");
      const tool = options.name ? "NameSearch" : "ContentSearch";
      const input = options.name ? { name: positional[0] } : { query: positional[0] };
      input.matchType = options.exact ? "exact" : "partial";
      input.entityTypes = options.type || [];
      if (options.inbox) input.inbox = options.inbox;
      applyTagOptions(input, options);
      await callTool(tool, input, fullJson, { limit });
    },
  },
  recent: {
    specs: {
      "--type": "repeat",
      "--sort": "value",
      "--signal": "boolean",
      "--inbox": "value",
      ...TAG_SPECS,
    },
    async run({ positional, options, fullJson }) {
      if (positional.length) fail("Usage: macro recent [options]");
      const sortBy = options.sort || "recently_updated";
      if (!["recently_updated", "recently_created", "recently_viewed"].includes(sortBy)) {
        fail("Invalid --sort value");
      }
      const input = { sortBy };
      if (options.type) input.includeTypes = options.type;
      if (options.signal) input.emailPreset = "signal";
      if (options.inbox) input.inbox = options.inbox;
      applyTagOptions(input, options);
      await callTool("ListEntities", input, fullJson);
    },
  },
  read: {
    specs: { "--metadata": "boolean" },
    async run({ positional, options, fullJson }) {
      if (positional.length !== 1) fail("Usage: macro read <document-id> [--metadata] [--json]");
      await callTool(options.metadata ? "ReadMetadata" : "ReadContent", { documentId: positional[0] }, fullJson);
    },
  },
  create: {
    specs: {
      "--file": "value",
      "--content": "value",
      "--ext": "value",
      "--task": "boolean",
    },
    async run({ positional, options, fullJson }) {
      if (positional.length !== 1) fail("Usage: macro create <name> [options]");
      if (options.file && options.content !== undefined) fail("Use only one of --file or --content");
      let content;
      if (options.file) content = await readFile(options.file, "utf8");
      else if (options.content !== undefined) content = options.content;
      else if (!process.stdin.isTTY) content = await readStdin();
      else fail("Provide --file, --content, or pipe content on stdin");
      const inferred = options.file ? extname(options.file).slice(1) : "";
      const extension = (options.ext || inferred || "md").replace(/^\./, "");
      if (options.task && extension !== "md") fail("Macro tasks must use --ext md");
      await callTool("CreateDocument", {
        documentName: positional[0],
        fileContent: content,
        fileExtension: extension,
        isTask: Boolean(options.task),
      }, fullJson);
    },
  },
};

async function run(rawArgs) {
  const { args, json: fullJson } = peelGlobals(rawArgs);
  const command = args.shift();
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }
  if (command === "--version" || command === "-v" || command === "version") {
    console.log(VERSION);
    return;
  }
  const entry = COMMANDS[command];
  if (!entry) fail(`Unknown command: ${command}\nRun: macro --help`);
  const { positional, options } = takeOptions(args, entry.specs || {});
  await entry.run({ positional, options, fullJson });
}

run(process.argv.slice(2)).catch((error) => {
  console.error(`macro: ${error.message}`);
  if (process.env.MACRO_CLI_DEBUG) console.error(error.stack);
  process.exitCode = error.exitCode || 1;
});
