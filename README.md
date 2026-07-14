# Macro CLI

An agent-friendly command-line tool for [Macro](https://macro.com).

Macro CLI gives shell tools and coding agents access to a Macro workspace without MCP support (or concerns about MCP performance). It handles OAuth, discovers the live server schema, exposes every official tool through a command, and provides concise commands for common workflows.

> This project is not affiliated with or endorsed by Macro. Macro MCP requires a paid Macro plan.

## Highlights

- OAuth 2.1 authorization-code flow with PKCE and a loopback callback
- Live MCP tool and JSON Schema discovery
- Generic access to every deployed Macro MCP tool
- Convenience commands for search, recency, documents, and tasks
- Compact search output designed for model context windows
- Full-fidelity `--json` escape hatch
- Automatic access-token refresh
- Bundled Pi Agent Skill with retrieval and write-safety practices

## Requirements

- Node.js 18.14 or newer
- A Macro account with MCP access
- A browser for the initial OAuth login

## Install

Install the CLI into `~/.local` without `sudo`:

```bash
curl -fsSL https://raw.githubusercontent.com/j8ckfi/macro-cli/main/install.sh | sh
```

Install the bundled skill globally for Pi through the open Agent Skills ecosystem:

```bash
npx --yes skills@latest add j8ckfi/macro-cli --skill macro-workspace --global --agent pi --yes
```

Then run `/reload` inside Pi. See [docs/installation.md](docs/installation.md) for custom prefixes, other agents, updates, uninstallation, and source installation.

<details>
<summary>Install from source</summary>

```bash
git clone https://github.com/j8ckfi/macro-cli.git
cd macro-cli
npm ci --ignore-scripts
npm link
```

</details>

## Quick start

```bash
macro login
macro status
macro search "roadmap"
```

The first command opens Macro's authorization page. Tokens are written to `~/.config/macro-cli/credentials.json` with mode `0600`; the containing directory is mode `0700`.

## Common workflows

### Discover the live server

```bash
macro tools
macro tools --json
macro schema ContentSearch
```

Macro's generated documentation may lag behind the deployed server, so live discovery is authoritative.

### Search and read

```bash
macro search "phase purity"                    # Content search
macro search "Experiment Outline" --name       # Name/title search
macro search "oxide" --type documents --exact
macro search "oxide" --limit 25
macro search "oxide" --all

macro read <document-id>
macro read <document-id> --metadata
```

Search returns at most 10 compact results by default and reports `total`, `returned`, and `truncated`. Use `--all` for every compact result or `--json` for the complete MCP response.

### Browse recent work

```bash
macro recent
macro recent --type document --sort recently_updated
macro recent --type email --signal
macro recent --tag urgent
```

### Create content

```bash
macro create "Meeting notes" --file ./notes.md
printf '# Follow up\n' | macro create "Follow up" --task
```

### Call any MCP tool

```bash
macro call ListTags '{}'
macro call ToolName '{"key":"value"}'
macro call ToolName @arguments.json
printf '%s' '{"key":"value"}' | macro call ToolName -
```

Tool names and argument casing must match `macro schema TOOL_NAME` exactly.

## Output modes

Default output is compact, agent-oriented JSON. For search results it keeps actionable IDs, ownership and project metadata, participants, labels, populated properties, and every match. It removes transport duplication, nulls, empty property definitions, ranking scores, raw serialized editor nodes, and duplicate aliases.

```bash
macro search "query"          # Compact output, maximum 10 results
macro search "query" --all    # Compact output, every result
macro search "query" --json   # Complete, unmodified MCP response
```

See [docs/output.md](docs/output.md) for the exact fidelity boundary.

## Authentication and configuration

```bash
macro login             # Sign in or replace credentials
macro login --no-open   # Print the URL without launching a browser
macro status
macro logout
```

Environment variables:

| Variable | Purpose |
| --- | --- |
| `MACRO_CLI_CONFIG_DIR` | Override the credential directory |
| `MACRO_MCP_URL` | Override the MCP endpoint, primarily for tests |
| `MACRO_CLI_DEBUG` | Include stack traces in CLI errors |

Credentials are pinned to the endpoint that issued them. Macro CLI refuses to send a stored bearer token to a different `MACRO_MCP_URL`; use a separate config directory and login for each endpoint.

For the credential model, privacy implications, and safe debugging guidance, read [docs/security.md](docs/security.md).

## Agent skill

The bundled [`macro-workspace`](skills/macro-workspace/) skill follows the Agent Skills specification and is installable directly from GitHub with `npx skills`. It teaches supported agents to discover live schemas, search efficiently, follow references, and confirm externally visible writes.

```bash
# Inspect without installing
npx --yes skills@latest add j8ckfi/macro-cli --list

# Install globally for Pi
npx --yes skills@latest add j8ckfi/macro-cli --skill macro-workspace -g -a pi -y
```

## Documentation

- [Installation](docs/installation.md)
- [CLI reference](docs/cli.md)
- [Output format and fidelity](docs/output.md)
- [Architecture](docs/architecture.md)
- [Security and privacy](docs/security.md)
- [Agent development practices](AGENTS.md)

## Development

```bash
npm ci --ignore-scripts
npm test
npm audit --omit=dev
```

The test suite uses a local mock OAuth/MCP server and synthetic fixtures.

## License

[MIT](LICENSE)
