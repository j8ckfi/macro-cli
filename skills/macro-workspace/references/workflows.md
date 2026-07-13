# Macro CLI workflows

## Search and read a document

```bash
macro search "roadmap" --name --type documents
# Search defaults to at most 10 compact results. Add --limit N or --all if needed;
# use --json only when low-level fields omitted by compact output are required.
macro read <documentId>
macro read <documentId> --metadata
```

For content rather than a title:

```bash
macro search '"launch plan"' --type documents --exact
```

The search type vocabulary comes from the live schema. Search often uses plural index names such as `documents`, `emails`, `channels`, and `call_records`; `ListEntities` uses singular item types such as `document`, `email`, `channel`, and `call`.

## Catch up on recent activity

```bash
macro recent --sort recently_updated
macro recent --type email --signal
macro recent --type document --tag urgent
```

For a time window or channel-specific summary, inspect `macro schema ListEntities` and pass the required filters through `macro call ListEntities @args.json`.

## Read email

```bash
macro call ListInboxes '{}'
macro search "customer export" --type emails
macro call GetThread '{"threadId":"<id>","limit":20}'
```

Before changing a label:

```bash
macro call ListLabels '{}'
macro call UpdateThreadLabels '{"thread_id":"<thread-id>","label_id":"<label-id>","add":true}'
```

Confirm parameter casing against the live schema.

## Read a channel

First find the channel:

```bash
macro search "engineering" --name --type channels
macro schema ReadChannelMessages
```

Then call the live schema, for example:

```bash
macro call ReadChannelMessages '{"channelId":"<id>","windowType":"latest","limit":25}'
```

Use `ReadChannelThread` for replies, not a huge channel timeline request.

## Create a document or task

```bash
macro create "Release notes" --file ./release-notes.md
printf '# Follow up\n\n- [ ] Verify rollout\n' | macro create "Verify rollout" --task
```

Report the returned document ID. Creating a task does not automatically assign it; use properties afterward if requested.

## Edit a document

```bash
macro schema EditDocument
macro call EditDocument @/tmp/macro-edit.json
```

Example argument file:

```json
{
  "document_id": "<document-id>",
  "instructions": "Append a Decisions section containing the three approved decisions. Preserve all existing content."
}
```

If the response asks for clarification, do not guess; obtain the information and call again.

## Update task properties

1. Read `macro schema GetEntityProperties` and `macro schema SetEntityProperty`.
2. Call `GetEntityProperties` with the task/entity ID and type.
3. Identify the property definition and valid option/reference IDs.
4. Show the intended change.
5. Call `SetEntityProperty` with exactly one matching value field.
6. Read properties again to verify.

## Send a channel message

1. Resolve and read the destination channel.
2. Draft the exact text.
3. Obtain confirmation of the channel, thread (if any), and text unless already explicitly approved.
4. Call `SendChannelMessage` once.
5. Report the returned message ID; never retry blindly after an ambiguous transport failure.

## Full-fidelity generic calls

Literal JSON:

```bash
macro call ToolName '{"key":"value"}' --json
```

Argument file:

```bash
cat > /tmp/macro-args.json <<'JSON'
{
  "key": "value"
}
JSON
macro call ToolName @/tmp/macro-args.json
rm /tmp/macro-args.json
```

Stdin:

```bash
printf '%s' '{"key":"value"}' | macro call ToolName -
```
