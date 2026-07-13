# Output format and fidelity

Macro's MCP tools often return structured content twice: once as JSON text and once in `structuredContent`. Search records may also contain full property definitions, ranking internals, and serialized editor nodes. Passing that response directly to an agent wastes context and can obscure the fields needed for the next call.

Macro CLI therefore has two output modes.

## Compact mode

Compact mode is the default. It prints `structuredContent` as readable JSON and applies tool-specific normalization where it is safe and useful.

Search normalization preserves:

- entity type and actionable IDs;
- names, subjects, file and subtype information;
- owner, user, inbox, project, and parent-project IDs;
- creation, update, view, interaction, call, and email state metadata;
- participants, senders, recipients, CC/BCC, labels, and tags;
- populated property names, definition IDs, values, readable system labels, and original option IDs;
- every returned match, its message/thread/node/transcript IDs, timestamps, and complete highlight text.

It removes:

- duplicate text/structured transport representations;
- null values and empty arrays/objects;
- property definitions with no value;
- search ranking scores;
- raw serialized editor nodes;
- duplicate aliases such as identical generic and type-specific names;
- Macro's `<macro_em>` wrappers while retaining the enclosed text.

Default search output is bounded to 10 entities. The envelope reports:

```json
{
  "total": 23,
  "returned": 10,
  "truncated": true,
  "results": []
}
```

This result limit is intentionally lossy and explicit. Use `--all` when the agent needs every compact result.

Some non-search list tools also receive conservative normalization. For example, notification output drops profile-picture URLs and flattens useful message metadata. Read tools and property-discovery tools remain structurally intact because their detail is the point of the call.

## Full mode

Pass `--json` for the complete MCP result:

```bash
macro search "query" --json
macro call ToolName @args.json --json
```

This is the escape hatch for debugging, protocol work, or fields not represented by a compactor. Full mode may duplicate content and may contain substantially more private workspace data.

## Fidelity testing

Compaction tests use synthetic fixtures for documents, email, channels, properties, long highlights, and truncation behavior. During development, a one-off live comparison across 13 one-result searches—documents, projects, channels, and email—preserved the chosen semantic representation in all 13 cases while reducing serialized size by 63.8% overall.

Live workspace data is never checked into the repository. Repeat live comparisons only with the workspace owner's authorization, redirect output to a private temporary location, and inspect summaries rather than committing fixtures.
