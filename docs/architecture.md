# Architecture

Macro CLI is intentionally small. It is a local MCP client, not an MCP proxy or server.

## Components

```text
index.js
  ├─ command parsing
  ├─ OAuth login and token refresh
  ├─ credential persistence
  ├─ MCP client lifecycle
  └─ convenience-command adapters

install.sh
  └─ user-scoped npm installation from GitHub

format.js
  ├─ search compaction
  └─ notification normalization

skills/macro-workspace/
  ├─ portable Agent Skill entry point
  └─ progressive reference documentation

test/
  ├─ local OAuth/MCP integration test
  └─ output-fidelity unit tests
```

The only runtime dependency is the official `@modelcontextprotocol/sdk` package.

## Request lifecycle

1. Parse the command and arguments.
2. Read credentials from the selected config directory.
3. Verify that the credential endpoint exactly matches the configured MCP endpoint.
4. Create an MCP `Client` and `StreamableHTTPClientTransport` with the bearer token.
5. Initialize the MCP session.
6. Execute discovery or a tool call.
7. If authorization fails, exchange the refresh token once and reconnect.
8. Print compact output or the complete MCP result.
9. Close the client and transport.

## OAuth lifecycle

1. Generate a random PKCE verifier and OAuth state.
2. Start an HTTP callback on a random `127.0.0.1` port.
3. Dynamically register a public OAuth client.
4. Open `/authorize` with PKCE S256.
5. Validate callback state and receive the broker authorization code.
6. Exchange the code for access and refresh tokens.
7. Atomically write credentials with restrictive filesystem permissions.

No client secret is used or expected for this public client.

## Convenience commands

Convenience commands map ergonomic flags to live MCP tools:

| CLI command | MCP tool |
| --- | --- |
| `search` | `ContentSearch` or `NameSearch` |
| `recent` | `ListEntities` |
| `read` | `ReadContent` or `ReadMetadata` |
| `create` | `CreateDocument` |

Everything else remains accessible through `macro call`. The CLI does not maintain a static copy of every tool schema because the deployed server changes independently.

## Design constraints

- Live tool schemas are authoritative.
- The CLI parser has no third-party dependency.
- Default output should minimize model context without hiding actionable search evidence.
- `--json` must remain a lossless protocol escape hatch.
- Tests must use synthetic data and a local server.
- Write safety is an agent-policy concern documented by the bundled skill; the generic CLI intentionally does not guess whether a live tool is destructive.
