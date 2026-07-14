# Security and privacy

Macro CLI handles bearer credentials and private workspace content. Treat terminal output, debug logs, shell history, temporary argument files, and exported MCP responses accordingly.

## Credential storage

The default credential file is:

```text
~/.config/macro-cli/credentials.json
```

The directory is created with mode `0700` and the file with mode `0600`. Writes use a temporary file followed by an atomic rename. The file contains OAuth access and refresh tokens in plaintext; filesystem permissions, not encryption or an OS keychain, protect it.

Use `macro logout` to delete the file. This does not revoke the token upstream. If a token may have been exposed, revoke the Macro authorization/session as well as deleting the local file.

Never:

- copy credentials into this repository;
- pass tokens as command-line arguments;
- paste `--json` output into public issues;
- enable `MACRO_CLI_DEBUG` in logs that will be shared without reviewing them;
- commit real workspace responses as test fixtures.

## Endpoint pinning

Credentials record the MCP endpoint used during login. Before connection or refresh, the CLI compares it with `MACRO_MCP_URL` and refuses a mismatch. This prevents a test or hostile endpoint override from receiving the stored Macro bearer token.

For alternate endpoints, isolate credentials:

```bash
MACRO_MCP_URL=https://example.invalid/mcp \
MACRO_CLI_CONFIG_DIR=~/.config/macro-cli-example \
macro login
```

## OAuth protections

- Authorization-code flow with PKCE S256
- Cryptographically random verifier and state
- State validation on callback
- Loopback listener bound to `127.0.0.1`, not all interfaces
- Random callback port
- Five-minute callback timeout
- No client secret for the public client

## Workspace data

Search, read, and list output can include names, email addresses, message text, document excerpts, IDs, and internal project metadata. Compact mode reduces irrelevant data but is not a privacy filter. `--json` can expose the entire MCP response.

Prefer piping private output directly into a consuming process. If a temporary file is necessary, create it in a private directory, set restrictive permissions, and remove it promptly.

## Tool safety

`macro call` can invoke any tool exposed by the remote server, including tools with side effects. The CLI does not add an approval prompt because it is also used non-interactively. Agent integrations should follow the bundled skill's policy:

- read/search freely when requested;
- require an explicit user request for edits or state changes;
- confirm destination and exact content immediately before externally visible communication;
- do not retry an ambiguous write blindly.

## Repository hygiene

The repository ignores common credential, key, environment, database, log, and session files. Tests use synthetic IDs, domains, OAuth tokens, and a local mock MCP server.

Before publishing or pushing:

```bash
git status --short
git ls-files
npm test
npm audit --omit=dev
git log -p --all -- . | rg -i 'token|secret|password|private key'
```

Use a dedicated secret scanner such as Gitleaks when available. A clean grep is not proof that no secret exists; review filenames, commit metadata, binary blobs, and generated artifacts too.

## Installer and dependency posture

The CLI has no third-party runtime dependencies. The one-line installer uses a user-owned npm prefix, never invokes `sudo`, and disables lifecycle scripts. It downloads from the repository's public `main` branch; security-conscious users should review `install.sh` first or install a specific audited revision from source.

The Skills CLI clones the public repository and copies the selected skill into the target agent directory. Skills can direct agents to execute commands, so users should review `SKILL.md` and its references before installation. The `skills` CLI itself reports anonymous install telemetry unless `DISABLE_TELEMETRY=1` or `DO_NOT_TRACK=1` is set.

Review dependency updates and rerun tests, signature verification, and `npm audit` before merging them.

## Security audit performed for this repository

The repository was checked for tracked credentials, private workspace excerpts and IDs, suspicious filenames, key material, high-entropy strings, history leaks, unexpected symlinks, dependency vulnerabilities, and ignored-file gaps. No live tokens, credential files, workspace exports, or private Macro content were found in tracked files or reachable history. Synthetic values such as `test-access` and `owner@example.com` appear only in tests.
