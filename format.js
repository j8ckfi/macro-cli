const SEARCH_TOOLS = new Set(["ContentSearch", "NameSearch"]);

const KNOWN_OPTION_LABELS = new Map([
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
  const labels = property.currentValueLabels || property.current_value_labels;
  const raw = property.value?.value ?? property.value;
  const knownLabels = Array.isArray(raw) && raw.every((item) => KNOWN_OPTION_LABELS.has(item))
    ? raw.map((item) => KNOWN_OPTION_LABELS.get(item))
    : undefined;
  return prune({
    name: definition.display_name || definition.displayName,
    id: definition.id,
    type: definition.data_type || definition.dataType,
    value: !isEmpty(labels) ? labels : (knownLabels || raw),
    optionIds: knownLabels ? raw : undefined,
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
    nodeId: match.node_id,
    messageId: match.message_id,
    threadId: match.thread_id,
    chatMessageId: match.chat_message_id,
    transcriptId: match.transcript_id,
    senderId: match.sender_id,
    speakerId: match.speaker_id,
    sequenceNumber: match.sequence_num,
    sender: match.sender,
    senderName: match.pretty_sender && match.pretty_sender !== match.sender ? match.pretty_sender : undefined,
    recipients: match.recipients,
    cc: match.cc,
    bcc: match.bcc,
    labels: match.labels,
    role: match.role,
    sentAt: match.sent_at,
    createdAt: match.created_at,
    updatedAt: match.updated_at,
    deletedAt: match.deleted_at,
    startedAt: match.started_at,
    endedAt: match.ended_at,
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
    type: item.type,
    id: item.id || item.document_id || item.thread_id || item.channel_id || item.chat_id || item.call_id,
    name: item.name || item.document_name || item.subject || metadata.channel_name,
    documentId: item.document_id,
    threadId: item.thread_id,
    channelId: item.channel_id,
    chatId: item.chat_id,
    callId: item.call_id,
    companyId: item.company_id,
    ownerId: item.owner_id,
    userId: item.user_id,
    linkId: item.link_id,
    projectId: metadata.project_id,
    parentProjectId: metadata.parent_project_id,
    fileType: item.file_type,
    subType: item.sub_type,
    channelType: item.channel_type,
    subject: item.subject && item.subject !== item.name ? item.subject : undefined,
    snippet: truncate(item.snippet, 300),
    participants,
    participantIds: item.participant_ids,
    domains: item.domains,
    createdAt: item.created_at || metadata.created_at,
    updatedAt: item.updated_at || metadata.updated_at,
    viewedAt: item.viewed_at || metadata.viewed_at,
    interactedAt: metadata.interacted_at,
    startedAt: metadata.started_at,
    endedAt: metadata.ended_at,
    durationMs: metadata.duration_ms,
    status: metadata.status,
    attended: metadata.attended,
    channelName: metadata.channel_name,
    createdBy: metadata.created_by,
    isRead: item.is_read,
    inboxVisible: item.inbox_visible,
    isDraft: item.is_draft,
    isImportant: item.is_important,
    tags: item.tags,
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
    id: notification.id,
    createdAt: notification.createdAt,
    seen: notification.seen,
    done: notification.done,
    eventType: notification.eventType,
    entityType: notification.entityType,
    entityId: notification.entityId,
    senderId: notification.senderId,
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

function compactEntities(output) {
  if (!Array.isArray(output?.items)) return output;
  return prune({
    count: output.items.length,
    summary: output.summary,
    items: output.items,
  });
}

export function compactToolOutput(toolName, output, options = {}) {
  if (SEARCH_TOOLS.has(toolName)) return compactSearch(output, options);
  if (toolName === "ListNotifications") return compactNotifications(output);
  if (toolName === "ListEntities") return compactEntities(output);
  return output;
}
