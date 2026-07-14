const PROTOCOL_VERSION = "2025-03-26";
let nextRequestId = 1;
let sdkModules;

export class McpRequestError extends Error {
  constructor(message, { httpStatus, rpcCode, data, fallbackEligible = false } = {}) {
    super(message);
    this.name = "McpRequestError";
    this.code = httpStatus;
    this.httpStatus = httpStatus;
    this.rpcCode = rpcCode;
    this.data = data;
    this.fallbackEligible = fallbackEligible;
  }
}

function protocolFailure(status, message) {
  const rejectedBeforeExecution = [405, 406, 415, 422, 501].includes(status)
    || /initializ|session|protocol version|unsupported (?:media|content)|not acceptable/i.test(message);
  return new McpRequestError(message, {
    httpStatus: status,
    fallbackEligible: rejectedBeforeExecution,
  });
}

function parseEventStream(body, id) {
  for (const event of body.split(/\r?\n\r?\n/)) {
    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      const message = JSON.parse(data);
      if (message?.id === id) return message;
    } catch {
      // Ignore keepalives or non-JSON events and continue to the response event.
    }
  }
  throw new McpRequestError("MCP event stream did not contain the JSON-RPC response");
}

function rpcFallbackEligible(error) {
  const message = `${error?.message || ""} ${JSON.stringify(error?.data || "")}`;
  return /initializ|session|protocol version|not supported/i.test(message);
}

export async function directMcpRequest({ url, accessToken, method, params = {}, fetchImpl = fetch }) {
  const id = nextRequestId++;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });

  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();
  if (!response.ok) {
    throw protocolFailure(response.status, `MCP request failed (HTTP ${response.status}): ${body || response.statusText}`);
  }
  let message;
  if (contentType.includes("text/event-stream")) {
    message = parseEventStream(body, id);
  } else {
    try {
      message = JSON.parse(body);
    } catch {
      throw new McpRequestError("MCP server returned invalid JSON");
    }
  }
  if (message?.jsonrpc !== "2.0" || message?.id !== id) {
    throw new McpRequestError("MCP server returned a mismatched JSON-RPC response");
  }
  if (message.error) {
    throw new McpRequestError(message.error.message || "MCP request failed", {
      rpcCode: message.error.code,
      data: message.error.data,
      fallbackEligible: rpcFallbackEligible(message.error),
    });
  }
  if (!("result" in message)) {
    throw new McpRequestError("MCP server response did not include a result");
  }
  return message.result;
}

async function loadSdk() {
  if (!sdkModules) {
    sdkModules = Promise.all([
      import("@modelcontextprotocol/sdk/client/index.js"),
      import("@modelcontextprotocol/sdk/client/streamableHttp.js"),
    ]);
  }
  const [{ Client }, { StreamableHTTPClientTransport }] = await sdkModules;
  return { Client, StreamableHTTPClientTransport };
}

export async function connectSdkClient({ url, accessToken, name, version }) {
  const { Client, StreamableHTTPClientTransport } = await loadSdk();
  const client = new Client({ name, version }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  await client.connect(transport);
  return client;
}

export function shouldFallbackToSdk(error) {
  return error?.fallbackEligible === true;
}

export function initializeParams(name, version) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name, version },
  };
}
