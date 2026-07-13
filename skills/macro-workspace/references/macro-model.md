# Macro workspace model and permissions

## Blocks and entity types

Macro models everything as a block. Public documentation lists these first-party types:

- `md` documents, including tasks and snippets
- `email`
- `channel`
- `chat` agent conversations
- `automation`
- `project`
- `contact` and `company` CRM records
- `call`
- `canvas`
- `code`, `image`, `video`, `pdf`
- `unknown` fallback

Search-index names and tool entity enums are not always the same. Read each live schema instead of translating by intuition.

## Mentions

Mentions are bidirectional references and can have side effects:

- In an agent prompt, a mention pins known context and avoids a search round.
- Mentioning a document/block in a channel shares it with channel members; membership changes flow through to access.
- Mentioning a person in a channel/comment notifies them.
- Mentioning a person in a document/task body does not notify them.
- Mentioning a person in email adds them as a recipient/CC.
- Mentioning a document in email inserts a link and changes its permissions so recipients can open it.
- Mentioning channels/messages does not grant channel access.

Do not synthesize mention markup or rely on sharing side effects unless the user asked for them and the live write-tool schema supports them.

## Permissions

- MCP authenticates through Macro OAuth and acts with the user's identity/permissions.
- MCP access currently requires a paid subscription.
- Documents support owner, editor, commenter, and viewer access.
- Tasks are generally visible to the user's team and enter team memory by default.
- Call recordings/transcripts enter team memory by default unless the caller opts out.
- Search and agents only return entities the user can access.
- Anything created or changed through MCP is attributed to the authenticated user.

A missing item may be absent, indexed differently, or inaccessible. Do not claim it does not exist after one narrow search.

## Search behavior

Macro search is literal keyword/prefix search rather than semantic search:

- Use 1–3 words likely to appear in the title or body.
- For documents and emails, whitespace-separated terms are ANDed and can match across different fields/chunks.
- For channels, chats, calls, and most non-email names, the full query behaves like one adjacent phrase prefix; long natural-language queries often fail.
- Exact mode disables prefix expansion.
- Quoted multi-word text keeps it together as one phrase.
- Separate a person lookup from a topic lookup.
- Start broad and only set entity types when the request clearly identifies them.

## Properties and tags

Properties are shared structured fields across entities. Supported categories include string, number, boolean, date, single/multi select, entity reference, and link. Tasks have system properties such as status, priority, assignees, due date, parent/subtasks, and story points. CRM companies have stage, owner, and revenue.

Use `GetEntityProperties` before changing custom or team-configurable fields. Use `ListTags` to resolve tag labels/IDs. Atomic add/remove operations are safer than replacing an entire multi-select value.
