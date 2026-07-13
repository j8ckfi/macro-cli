# Macro CLI for Pi

A small command-line bridge to Macro's remote MCP endpoint:

```text
https://mcp-server.macro.com/mcp
```

It implements Macro's OAuth 2.1 browser flow with PKCE, stores credentials locally with mode `0600`, discovers the deployed tool schemas, and exposes both generic MCP calls and common workspace commands.

## Setup

The executable is linked at `~/.local/bin/macro`. Ensure `~/.local/bin` is on `PATH`, then authenticate:

```bash
macro login
macro status
```

Macro's server currently requires a paid Macro subscription for MCP access.

## Commands

```bash
macro tools                         # live tool discovery
macro schema ContentSearch          # full live schema
macro call ToolName '{"key":"value"}'
macro call ToolName @arguments.json

macro search "roadmap" --name
macro recent --type document
macro read <document-id>
macro create "Notes" --file notes.md
```

Run `macro --help` for all options.

## Authentication

`macro login`:

1. dynamically registers a public OAuth client;
2. starts a loopback callback on a random `127.0.0.1` port;
3. opens Macro's browser authorization flow using PKCE S256;
4. exchanges the returned code for access and refresh tokens.

Credentials are stored in `~/.config/macro-cli/credentials.json`. Override this location with `MACRO_CLI_CONFIG_DIR`; override the endpoint for testing with `MACRO_MCP_URL`.

```bash
macro logout
```

## Pi skill

The accompanying global Pi skill is installed at:

```text
~/.pi/agent/skills/macro-workspace/
```

It documents retrieval strategy, write safety, Macro permissions, common workflows, and the difference between Macro's lagging generated tool pages and the live MCP registry.

## Development

```bash
cd ~/.local/share/macro-cli
npm test
```
