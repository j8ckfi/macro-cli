import assert from "node:assert/strict";
import test from "node:test";
import { compactSearch, compactToolOutput, prune } from "../format.js";

test("prune removes empty noise but preserves false and zero", () => {
  assert.deepEqual(prune({
    nil: null,
    empty: "",
    list: [],
    object: {},
    no: false,
    zero: 0,
    nested: { keep: "yes", drop: null },
  }), {
    no: false,
    zero: 0,
    nested: { keep: "yes" },
  });
});

test("search compaction keeps pointers and highlights, not raw nodes or empty properties", () => {
  const output = compactSearch({
    results: [{
      type: "document",
      id: "doc-1",
      document_id: "doc-1",
      name: "Formal plan",
      document_name: "Formal plan",
      file_type: "md",
      sub_type: "task",
      metadata: {
        created_at: "2026-07-12T01:00:00Z",
        updated_at: "2026-07-13T01:00:00Z",
        deleted_at: null,
      },
      document_search_results: [{
        node_id: "node-1",
        raw_content: "a very large serialized editor node",
        score: 4.2,
        highlight: { content: ["A <macro_em>formal</macro_em> milestone"] },
      }],
      properties: [
        { definition: { id: "empty", display_name: "Assignees", data_type: "ENTITY" } },
        {
          definition: { id: "status", display_name: "Status", data_type: "SELECT_STRING" },
          value: { type: "SelectOption", value: ["00000001-0000-0000-0002-000000000001"] },
        },
      ],
    }],
  });

  assert.deepEqual(output, {
    total: 1,
    returned: 1,
    truncated: false,
    results: [{
      type: "document",
      id: "doc-1",
      name: "Formal plan",
      documentId: "doc-1",
      fileType: "md",
      subType: "task",
      createdAt: "2026-07-12T01:00:00Z",
      updatedAt: "2026-07-13T01:00:00Z",
      properties: [{ name: "Status", id: "status", type: "SELECT_STRING", value: ["Not Started"] }],
      matches: [{ nodeId: "node-1", snippets: ["A formal milestone"] }],
    }],
  });
  assert.doesNotMatch(JSON.stringify(output), /raw_content|serialized editor|score/);
});

test("search compaction reports result and match truncation", () => {
  const item = (id) => ({
    type: "channel",
    id,
    channel_id: id,
    channel_message_search_results: [1, 2, 3, 4].map((number) => ({
      message_id: `${id}-message-${number}`,
      highlight: { content: [`match ${number}`] },
    })),
  });
  const output = compactSearch({ results: [item("one"), item("two"), item("three")] }, { limit: 2, matchLimit: 3 });
  assert.equal(output.total, 3);
  assert.equal(output.returned, 2);
  assert.equal(output.truncated, true);
  assert.equal(output.results[0].matches.length, 3);
  assert.equal(output.results[0].omittedMatches, 1);
});

test("notification compaction drops profile URLs and redundant metadata", () => {
  const output = compactToolOutput("ListNotifications", {
    hasMore: false,
    notifications: [{
      id: "notification-1",
      seen: true,
      done: false,
      entityType: "channel",
      entityId: "channel-1",
      metadata: {
        channelName: "Engineering",
        messageContent: "A useful message",
        messageId: "message-1",
        senderProfilePictureUrl: "https://example.invalid/large-profile-url",
      },
    }],
  });
  assert.deepEqual(output, {
    count: 1,
    hasMore: false,
    notifications: [{
      id: "notification-1",
      seen: true,
      done: false,
      entityType: "channel",
      entityId: "channel-1",
      channelName: "Engineering",
      message: "A useful message",
      messageId: "message-1",
    }],
  });
});
