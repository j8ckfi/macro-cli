# AGENTS.md

This file defines development practices for coding agents working in this repository. It is not the runtime Macro workspace skill; that lives in `skills/macro-workspace/`.

## Mission

Maintain a small, auditable CLI that makes Macro's remote MCP server pleasant and safe to use from shells and coding agents.

Optimize for, in order:

1. Credential and workspace-data safety
2. Semantic correctness
3. Live MCP compatibility
4. Agent context efficiency
5. Human usability
6. Minimal dependencies and implementation complexity

## Repository map

- `index.js` — CLI, OAuth, credential storage, MCP transport, command adapters
- `format.js` — compact output normalization
- `test/cli.test.js` — end-to-end tests against a local mock OAuth/MCP server
- `test/format.test.js` — semantic-fidelity tests for compact output
- `skills/macro-workspace/` — portable Agent Skill installed through `npx skills`
- `docs/` — human and maintainer documentation

## Required workflow

Before changing code:

1. Read `README.md` and the relevant file under `docs/`.
2. Inspect `git status`; do not overwrite unrelated work.
3. Identify whether the change affects authentication, output fidelity, write safety, or private data.

After changing code:

```bash
node --check index.js
node --check format.js
sh -n install.sh
npm test
npm audit --omit=dev
git diff --check
git status --short
```

Do not push, publish, tag, or create a release unless the user explicitly requests it.

## Security rules

- Never read, print, copy, or commit `~/.config/macro-cli/credentials.json`.
- Never add a real access token, refresh token, user email, workspace UUID, document excerpt, message, or search response to a fixture.
- Use `example.com`, obvious fake UUIDs/IDs, and values such as `test-access` in tests.
- Tests must not contact Macro or any other external service.
- Keep credentials bound to their issuing endpoint. Any endpoint-override work requires a regression test proving tokens cannot be sent cross-origin or to a different path.
- Do not weaken callback state validation, PKCE, loopback binding, file modes, or atomic credential writes.
- Do not add telemetry.
- Keep the installer user-scoped, free of `sudo`, and non-interactive. npm lifecycle scripts must remain disabled.
- Avoid new dependencies. If one is necessary, explain why the standard library is insufficient, pin it through the lockfile, inspect lifecycle scripts, and run an audit.
- Treat compact output as private data; compaction is not redaction.

## Live-server rules

Macro's deployed schemas are authoritative; generated web documentation can lag. Do not hard-code a broad static tool catalog into the CLI.

Live calls are allowed only when the user asks for integration testing or workspace work:

- Prefer read-only discovery (`status`, `tools`, `schema`) first.
- Redirect large output to a private temporary file and remove it afterward.
- Never invoke a write tool during development or testing without the user's explicit request.
- Never turn live responses into committed snapshots.

## Output-compaction contract

Compact search output may remove only low-signal representation details:

- duplicate transport/text representations;
- null and empty values;
- empty property definitions;
- ranking scores;
- raw serialized editor nodes;
- duplicate aliases;
- highlight markup while retaining its text.

It must preserve:

- actionable entity and match IDs;
- ownership, project, inbox, and temporal metadata;
- participants, senders, recipients, labels, and tags;
- populated property values and original option IDs;
- every match and complete highlight text.

The default 10-result limit is allowed only because `total`, `returned`, and `truncated` make it explicit, `--all` returns every compact result, and `--json` returns the complete MCP response.

Every compaction change needs a synthetic regression test. If a field's value is uncertain, preserve it rather than guessing that it is noise.

## CLI behavior

- Preserve existing commands and exit codes unless a breaking change is intentional and documented.
- Keep tool names and parameter casing exactly as reported by live schemas.
- Prefer argument files for complex JSON.
- Errors go to stderr; successful machine-readable output goes to stdout.
- Never print credentials or authorization headers, including under debug mode.
- Close MCP clients in `finally` blocks.
- A tool result with `isError: true` exits with status `3` after printing the result.

## Skill maintenance

The Agent Skill is progressive documentation, not a copy of every schema. Keep it discoverable under `skills/NAME/SKILL.md` so `npx skills add j8ckfi/macro-cli --list` can find it.

When behavior changes:

1. Update `skills/macro-workspace/SKILL.md` if agent instructions change.
2. Put detailed workflows or domain notes in `skills/macro-workspace/references/`.
3. Keep the skill description specific enough for automatic selection.
4. Preserve the safety requirement around externally visible writes.
5. Tell users to run `/reload` after changing an installed skill.

## Commit hygiene

- Keep commits focused and use imperative messages.
- Review staged files with `git diff --cached`.
- Check commit metadata does not expose a private email before any push.
- Do not commit temporary evaluations, live output, credentials, logs, databases, or `node_modules`.
- Do not rewrite published history. This repository has not been pushed at the time this file was added; ask before rewriting history later.
