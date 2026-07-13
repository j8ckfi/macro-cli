# CLI reference

Run `macro --help` for the installed version's concise reference. Global `--json` may appear anywhere in a command and requests the complete MCP response where applicable.

## Authentication

### `macro login [--no-open]`

Registers a public OAuth client, starts a temporary loopback callback on `127.0.0.1`, and performs an authorization-code exchange with PKCE S256.

- `--no-open`: print the authorization URL without launching a browser.
- The callback waits up to five minutes.
- A successful login replaces the credentials in the selected config directory.

### `macro logout`

Deletes the local credential file. It does not revoke the upstream Macro session.

### `macro status [--json]`

Connects to the MCP endpoint and reports authentication state, server identity, and capabilities.

## Discovery

### `macro tools [--json]`

Lists the deployed tools. Default output is one tab-separated name and description per line. `--json` returns the MCP `tools/list` result.

### `macro schema <tool> [--json]`

Prints one live tool definition and input schema. Tool names are case-sensitive.

## Generic tool calls

### `macro call <tool> [JSON|@file|-] [--json]`

Calls any live MCP tool.

Argument sources:

- literal JSON object: `'{"query":"oxide"}'`
- file: `@arguments.json`
- standard input: `-`
- omitted: `{}`

The command exits with status `3` when MCP returns a tool-level error.

## Search

### `macro search <query> [options]`

Calls `ContentSearch` by default or `NameSearch` with `--name`.

| Option | Meaning |
| --- | --- |
| `--name` | Search names/titles rather than content |
| `--exact` | Use exact token/phrase matching instead of prefixes |
| `--type <type>` | Restrict search type; repeatable |
| `--inbox <email>` | Restrict email results to one connected inbox |
| `--tag <label>` | Restrict results by tag; repeatable |
| `--tags-match any\|all` | Combine repeated tags |
| `--limit <number>` | Maximum compact results; default `10` |
| `--all` | Return all compact results |
| `--json` | Return the complete MCP response; compact limits do not apply |

Search index types come from the live schema and may differ from `ListEntities` types. At the time of writing they include `documents`, `chats`, `emails`, `channels`, `projects`, and `call_records`.

## Recent entities

### `macro recent [options]`

Calls `ListEntities`.

| Option | Meaning |
| --- | --- |
| `--type <type>` | Restrict item type; repeatable |
| `--sort recently_updated\|recently_created\|recently_viewed` | Sort order |
| `--signal` | Restrict to Signal email |
| `--inbox <email>` | Restrict email results to one inbox |
| `--tag <label>` | Restrict by tag; repeatable |
| `--tags-match any\|all` | Combine repeated tags |
| `--json` | Return the complete MCP response |

Use generic `macro call ListEntities @args.json` for advanced AST, time-window, property, or channel filters.

## Documents

### `macro read <document-id> [--metadata] [--json]`

Calls `ReadContent`, or `ReadMetadata` with `--metadata`.

### `macro create <name> [options]`

Calls `CreateDocument`.

| Option | Meaning |
| --- | --- |
| `--file <path>` | Read content from a UTF-8 file |
| `--content <text>` | Use literal content |
| `--ext <extension>` | Override extension; inferred from `--file`, otherwise `md` |
| `--task` | Create a Macro task; requires `md` |
| `--json` | Return the complete MCP response |

If neither `--file` nor `--content` is supplied, content is read from non-interactive standard input.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | CLI, network, protocol, or unexpected error |
| `2` | Authentication/configuration problem |
| `3` | MCP tool returned `isError: true` |

## Examples

```bash
macro search '"solid-state synthesis"' --type documents --exact
macro call GetThread '{"threadId":"<id>","limit":20}'
macro call ReadChannelMessages @channel-window.json
macro create "Release notes" --file release-notes.md
```
