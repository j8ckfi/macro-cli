# Macro MCP tool guide

The deployed result of `macro tools --json` and `macro schema <name>` is authoritative. The server was explored live on 2026-07-13: `macro-tools` v0.1.0 exposed 34 tools. Macro's public generated pages documented only 16, so they lag behind the deployed registry.

## Core discovery and reading

- `ListEntities`: Browse recent workspace activity. Best first call for summaries and recency questions. It supports item types, sorting, email presets/mailboxes, tags, and advanced AST filters.
- `NameSearch`: Literal name/title search. Email terms are ANDed; most other types match an adjacent phrase prefix.
- `ContentSearch`: Literal content search across document bodies, email fields, messages, and call transcripts.
- `ReadContent`: Read a document body by document ID.
- `ReadMetadata`: Read document metadata by document ID.
- `ReadChat`: Read an AI chat.
- `ReadChannelMessages`: Read a bounded channel timeline window.
- `ReadChannelMessageContext`: Read context around a channel message.
- `ReadChannelThread`: Read replies in a channel thread.
- `ListCallRecords` / `ReadCallRecord`: Find and read calls/transcripts.
- `GetThread`: Read an email thread.

Search is keyword/prefix search, not semantic search. Use quoted phrases or exact mode when precision matters. Search results should be followed by a read call.

## Documents and tasks

- `CreateDocument`: Create plaintext content. Arguments include `documentName`, `fileContent`, `fileExtension`, and `isTask`. Tasks must be Markdown.
- `RenameDocument`: Rename a document.
- `EditDocument`: Apply natural-language edits in place. If it returns `clarification`, call again with that information appended to the instructions.
- `GetEntityProperties`: Read properties and available options.
- `SetEntityProperty`: Update exactly one value matching the property's data type. Read the live schema carefully; this tool uses snake_case arguments.
- `ListTags`: Discover personal/team tags and IDs.

Macro tasks are documents with task subtype and system properties. To change status, assignee, priority, due date, or another field, call `GetEntityProperties` first unless the live tool description explicitly provides a safe system ID. For multi-select fields and tags, prefer atomic add/remove option arguments over replacing the entire list.

## Email

- `ListInboxes`: Discover connected/delegated inboxes.
- `ListLabels`: Discover label IDs.
- `GetThread`: Read a thread.
- `UpdateThreadLabels`: Add or remove one label from a thread.

Do not assume the MCP server can send email. The public docs list `SendEmail`, but the current open-source `mcp_tools()` deliberately uses an email toolset that excludes it. Always inspect the live list.

## Channels

- `ReadChannelMessages`: Latest, time-range, around-message, explicit-message, and cursor-page windows.
- `ReadChannelMessageContext`: Focused context for a specific message.
- `ReadChannelThread`: Thread replies.
- `SendChannelMessage`: Send or reply. Only call after explicit user approval of destination and content.

## Notifications, team, and CRM

The live server exposes:

- `ListNotifications`, `MarkNotificationsSeen`, `MarkNotificationsDone`
- `ListTeamMembers`
- `ListCompanies`, `GetCompany`

Use the live schemas because these newer tools do not appear in the generated web tool index.

## Other server tools

The live server also exposes `SelfKnowledge`, `Subagent`, `BashCodeExecution`, `TextEditorCodeExecution`, `WebFetch`, and `WebSearch`. `SelfKnowledge` was invoked successfully during verification and returned Macro's official product/docs map. Prefer Pi's local capabilities for shell, files, and public web access. Use Macro-specific tools only when they add workspace context or operate in the server environment.

## Public-doc versus source discrepancy

Public generated pages listed:

`bash_code_execution`, `ContentSearch`, `CreateDocument`, `GetEntityProperties`, `GetThread`, `ListEntities`, `NameSearch`, `ReadContent`, `ReadMetadata`, `ReadThread`, `SendEmail`, `SetEntityProperty`, `text_editor_code_execution`, `UpdateThreadLabels`, `web_fetch`, `web_search`.

The live server adds document editing/renaming, calls, chats, channel reading/writing, team, CRM, tags, notifications, inbox/label discovery, self-knowledge, and subagents; it excludes `SendEmail` from MCP. This is why discovery is mandatory.

## Live inventory (2026-07-13)

`BashCodeExecution`, `ContentSearch`, `CreateDocument`, `EditDocument`, `GetCompany`, `GetEntityProperties`, `GetThread`, `ListCallRecords`, `ListCompanies`, `ListEntities`, `ListInboxes`, `ListLabels`, `ListNotifications`, `ListTags`, `ListTeamMembers`, `MarkNotificationsDone`, `MarkNotificationsSeen`, `NameSearch`, `ReadCallRecord`, `ReadChannelMessageContext`, `ReadChannelMessages`, `ReadChannelThread`, `ReadChat`, `ReadContent`, `ReadMetadata`, `RenameDocument`, `SelfKnowledge`, `SendChannelMessage`, `SetEntityProperty`, `Subagent`, `TextEditorCodeExecution`, `UpdateThreadLabels`, `WebFetch`, `WebSearch`.
