const SEARCH_TOOLS = new Set(["ContentSearch", "NameSearch"]);

const SYSTEM_OPTION_LABELS = new Map([
  ["00000001-0000-0000-0002-000000000001", "Not Started"],
  ["00000001-0000-0000-0002-000000000002", "In Progress"],
  ["00000001-0000-0000-0002-000000000003", "In Review"],
  ["00000001-0000-0000-0002-000000000004", "Completed"],
  ["00000001-0000-0000-0002-000000000005", "Canceled"],
  ["00000001-0000-0000-0003-000000000001", "Low"],
  ["00000001-0000-0000-0003-000000000002", "Medium"],
  ["00000001-0000-0000-0003-000000000003", "High"],
  ["00000001-0000-0000-0003-000000000004", "Urgent"],
]);

function isEmpty(value) {
  return value === undefined
    || value === null
    || value === ""
    || (Array.isArray(value) && value.length === 0)
    || (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);
}

export function prune(value) {
  if (Array.isArray(value)) return value.map(prune).filter((item) => !isEmpty(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, prune(item)])
      .filter(([, item]) => !isEmpty(item)),
  );
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function project(source, mapping) {
  const result = {};
  for (const [key, spec] of Object.entries(mapping)) {
    const value = typeof spec === "function" ? spec(source) : source?.[spec];
    if (!isEmpty(value)) result[key] = value;
  }
  return result;
}

function truncate(value, length = 500) {
  if (typeof value !== "string" || value.length <= length) return value;
  return `${value.slice(0, length - 1)}…`;
}

function plainHighlight(value) {
  if (typeof value !== "string") return value;
  return value.replaceAll("<macro_em>", "").replaceAll("</macro_em>", "");
}

function unique(values) {
  return [...new Set(values.filter((value) => !isEmpty(value)))];
}

function compactProperty(property) {
  if (!property?.value) return undefined;
  const definition = property.definition || {};
  const liveLabels = firstDefined(property.currentValueLabels, property.current_value_labels);
  const raw = firstDefined(property.value?.value, property.value);
  const systemLabels = Array.isArray(raw) && raw.every((item) => SYSTEM_OPTION_LABELS.has(item))
    ? raw.map((item) => SYSTEM_OPTION_LABELS.get(item))
    : undefined;
  const labels = !isEmpty(liveLabels) ? liveLabels : systemLabels;
  return prune({
    name: firstDefined(definition.display_name, definition.displayName),
    id: definition.id,
    type: firstDefined(definition.data_type, definition.dataType),
    value: labels || raw,
    optionIds: labels && Array.isArray(raw) ? raw : undefined,
  });
}

function compactMatch(match) {
  const highlight = match?.highlight || {};
  const snippets = unique([
    highlight.name,
    ...(highlight.content || []),
    highlight.user_id,
    highlight.sender,
    ...(highlight.recipients || []),
    ...(highlight.cc || []),
    ...(highlight.bcc || []),
  ]).map(plainHighlight);

  return prune({
    ...project(match, {
      nodeId: "node_id",
      messageId: "message_id",
      threadId: "thread_id",
      chatMessageId: "chat_message_id",
      transcriptId: "transcript_id",
      senderId: "sender_id",
      speakerId: "speaker_id",
      sequenceNumber: "sequence_num",
      sender: "sender",
      recipients: "recipients",
      cc: "cc",
      bcc: "bcc",
      labels: "labels",
      role: "role",
      sentAt: "sent_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      startedAt: "started_at",
      endedAt: "ended_at",
    }),
    senderName: match.pretty_sender && match.pretty_sender !== match.sender
      ? match.pretty_sender
      : undefined,
    snippets,
  });
}

function searchMatches(item) {
  const keys = [
    "document_search_results",
    "email_message_search_results",
    "channel_message_search_results",
    "chat_search_results",
    "project_search_results",
    "call_search_results",
  ];
  return keys.flatMap((key) => Array.isArray(item[key]) ? item[key] : []);
}

function compactSearchItem(item, matchLimit) {
  const metadata = item.metadata || {};
  const allMatches = searchMatches(item);
  const matches = allMatches.slice(0, matchLimit).map(compactMatch).filter(Boolean);
  const properties = (item.properties || []).map(compactProperty).filter(Boolean);
  const participants = (item.participants || []).map((participant) => {
    if (typeof participant === "string") return participant;
    return prune({ name: participant.name, email: participant.email });
  });

  return prune({
    ...project(item, {
      type: "type",
      documentId: "document_id",
      threadId: "thread_id",
      channelId: "channel_id",
      chatId: "chat_id",
      callId: "call_id",
      companyId: "company_id",
      ownerId: "owner_id",
      userId: "user_id",
      linkId: "link_id",
      fileType: "file_type",
      subType: "sub_type",
      channelType: "channel_type",
      participantIds: "participant_ids",
      domains: "domains",
      isRead: "is_read",
      inboxVisible: "inbox_visible",
      isDraft: "is_draft",
      isImportant: "is_important",
      tags: "tags",
    }),
    id: item.id || item.document_id || item.thread_id || item.channel_id || item.chat_id || item.call_id,
    name: item.name || item.document_name || item.subject || metadata.channel_name,
    projectId: metadata.project_id,
    parentProjectId: metadata.parent_project_id,
    subject: item.subject && item.subject !== item.name ? item.subject : undefined,
    snippet: truncate(item.snippet, 300),
    participants,
    createdAt: firstDefined(item.created_at, metadata.created_at),
    updatedAt: firstDefined(item.updated_at, metadata.updated_at),
    viewedAt: firstDefined(item.viewed_at, metadata.viewed_at),
    interactedAt: metadata.interacted_at,
    startedAt: metadata.started_at,
    endedAt: metadata.ended_at,
    durationMs: metadata.duration_ms,
    status: metadata.status,
    attended: metadata.attended,
    channelName: metadata.channel_name,
    createdBy: metadata.created_by,
    properties,
    matches,
    omittedMatches: Math.max(0, allMatches.length - matches.length) || undefined,
  });
}

export function compactSearch(output, { limit = 10, matchLimit = Number.POSITIVE_INFINITY } = {}) {
  if (!Array.isArray(output?.results)) return output;
  const selected = output.results.slice(0, limit);
  return prune({
    total: output.results.length,
    returned: selected.length,
    truncated: output.results.length > selected.length,
    results: selected.map((item) => compactSearchItem(item, matchLimit)),
  });
}

function compactNotification(notification) {
  const metadata = notification.metadata || {};
  return prune({
    ...project(notification, {
      id: "id",
      createdAt: "createdAt",
      seen: "seen",
      done: "done",
      eventType: "eventType",
      entityType: "entityType",
      entityId: "entityId",
      senderId: "senderId",
    }),
    channelName: metadata.channelName,
    channelType: metadata.channelType,
    senderName: metadata.senderDisplayName,
    message: truncate(metadata.messageContent),
    messageId: metadata.messageId,
    threadId: metadata.threadId,
  });
}

function compactNotifications(output) {
  if (!Array.isArray(output?.notifications)) return output;
  return prune({
    count: output.notifications.length,
    hasMore: output.hasMore,
    notifications: output.notifications.map(compactNotification),
  });
}

export function compactToolOutput(toolName, output, options = {}) {
  if (SEARCH_TOOLS.has(toolName)) return compactSearch(output, options);
  if (toolName === "ListNotifications") return compactNotifications(output);
  return output;
}
