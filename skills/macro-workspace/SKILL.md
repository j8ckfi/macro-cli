---
name: macro-workspace
description: Search, read, create, and update a Macro workspace through the local `macro` CLI backed by Macro's remote MCP server. Use for Macro documents, tasks, email threads, channels, calls, CRM companies, notifications, tags, properties, recent activity, or unified workspace context.
compatibility: Requires Node.js 18+, the `macro` CLI, a Macro account, and a paid Macro plan for MCP access.
---

# Macro Workspace

Use the `macro` CLI; do not implement MCP requests with curl.

## Setup

Check the connection:

```bash
macro status --json
```

If it says `authenticated: false`, ask the user to run `macro login` and complete the browser sign-in. Macro MCP requires a paid subscription.

## Discover before calling

Macro's generated web documentation can lag behind the deployed server. At the start of a Macro task, discover the live surface:

```bash
macro tools --json
macro schema <ExactToolName>
```

The live schema is authoritative. Use exact tool names and parameter casing.

## Prefer the convenience commands

```bash
macro search "literal keywords"                   # ContentSearch, 10 compact results
macro search "title words" --name                 # NameSearch, 10 compact results
macro search "literal keywords" --limit 25        # Increase the compact result limit
macro search "literal keywords" --all             # Return all compact results
macro recent --type document --sort recently_updated
macro read <document-id>
macro read <document-id> --metadata
macro create "Document name" --file ./notes.md
```

Use generic calls for everything else:

```bash
macro call <ExactToolName> '{"parameter":"value"}'
macro call <ExactToolName> @/tmp/macro-arguments.json
```

For complex arguments, write a temporary JSON file and pass it with `@path` rather than fighting shell quoting. Default output removes transport duplication, empty properties, raw editor nodes, scores, and other low-signal fields. Use `--json` only when the task needs the complete unmodified MCP response.

## Retrieval strategy

1. For broad activity questions ("what happened today", "catch me up"), start with `ListEntities` or `macro recent`, using time/type/channel/mailbox filters from its live schema.
2. For a known title/name, use `NameSearch` with 1–3 literal title words.
3. For body text, email participants, or transcript content, use `ContentSearch` with 1–3 literal keywords.
4. Leave entity types empty unless the user clearly scopes the request.
5. Read the selected entity with the type-specific read tool. Search results are pointers, not full context.
6. For a person plus a topic, search them separately rather than putting both into one long query.

Read [references/workflows.md](references/workflows.md) for recipes and [references/macro-model.md](references/macro-model.md) for entity and permission behavior. Read [references/tools.md](references/tools.md) when selecting among tools.

## Safety

- Treat the authenticated workspace as private user data. Return only what the request needs.
- Agents inherit the user's Macro permissions; lack of results may be an access issue.
- Never send a channel message, change labels/properties, mark notifications done, edit a document, or invoke another write tool unless the user requested that action.
- For externally visible communication, show the exact destination and content and obtain confirmation immediately before the write unless the user already explicitly approved that exact send in the current request.
- Creating a requested document/task is allowed; report its returned ID.
- Prefer local Pi `bash`, `read`, and web tools over similarly named remote Macro tools unless the task specifically requires execution in Macro's environment.
- Do not assume `SendEmail` exists. Macro's current source excludes it from MCP even though older generated docs mention it; check the live tool list.
