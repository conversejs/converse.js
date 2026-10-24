export type Paths = {
    config: string; // The account configuration file
    runtime_dir: string; // Owner-only directory holding the sockets and pidfile
    socket: string; // Full access
    restricted_socket: string; // Restricted access
    pidfile: string;
    log: string; // Where an auto-spawned daemon writes its output
    cursors: string; // Each consumer's read cursors
    audit: string; // Every send, draft and refusal, one JSON line each
    drafts: string; // Drafts awaiting the owner's decision, and the id each was given
};

/**
 * What a connection may do. Full is the user's own access; restricted is what
 * agents get. The level is fixed by the socket a connection arrives on.
 */
export type Access = 'full' | 'restricted';

export type Policy = {
    allow: string[]; // Bare JIDs that restricted sends may be drafted for
    rate_limit: {
        per_conversation: number; // Restricted sends to one JID per window
        overall: number; // Restricted sends to anyone per window
        window: number; // Seconds
    };
};

export type Config = {
    jid: string; // Bare JID of the agent's account
    owner: string; // Bare JID of the user, to whom drafts are delivered
    password?: string; // Unset means: look in the system keyring
    websocket_url?: string;
    resource: string;
    consumer: string; // The name a client identifies itself by unless told otherwise
    access: Access; // The level the CLI connects at
    policy: Policy;
    settings: Record<string, unknown>; // Passed through to converse.initialize
    paths: Paths;
};

export type Status = {
    connected: boolean;
    jid: string | null; // The full JID once bound
    resumed: boolean; // Whether the current session was resumed (XEP-0198) after a dropped connection
    pid: number;
    started: string; // ISO 8601
    uptime: number; // Seconds
};

/**
 * The DTOs below are what clients see of headless's models. They're part of
 * the protocol (see PROTOCOL_VERSION).
 */

export type ConversationDTO = {
    jid: string; // Bare JID of the contact or room
    type: 'chat';
    name: string | null; // The roster name, if they're a contact
};

export type MessageDTO = {
    // The server's stanza-id (XEP-0359) if it assigned one, else the
    // origin-id, else the stanza's id attribute. Commands that target a
    // message accept any of the three, or a unique prefix of this one.
    id: string;
    conversation: string; // Bare JID
    from: string; // Bare JID of the sender
    direction: 'incoming' | 'outgoing';
    time: string; // ISO 8601
    body: string | null; // Untrusted: written by whoever sent the message
};

export type MessageList = {
    conversation: ConversationDTO;
    messages: MessageDTO[]; // Oldest first
};

/**
 * A send the agent asked for that went to the owner as text, not to its
 * recipient. The owner sends it themselves, from their own client, or doesn't.
 */
export type Draft = {
    id: string; // Short, and unique for the account, e.g. "d17"
    to: string; // Bare JID
    body: string; // Untrusted: written by the consumer that queued it
    consumer: string | null; // Who queued it
    created: string; // ISO 8601
};

/**
 * What a send came to. A refused send says which rule refused it, and what to
 * do about it. A draft is never sent by the daemon: its text went to the owner.
 */
export type SendResult =
    | { outcome: 'sent'; message: MessageDTO }
    | {
          outcome: 'refused';
          rule: 'allowlist' | 'rate_conversation' | 'rate_overall';
          message: string;
      }
    | { outcome: 'draft'; draft_id: string };

/**
 * An entry in the audit log. The body of a message isn't recorded.
 */
export type AuditEntry = {
    consumer: string | null;
    to: string; // Bare JID
    outcome: 'sent' | 'refused' | 'draft' | 'rejected';
    id?: string; // The DTO id, for a send
    draft?: string; // The draft's id, for a draft or a rejection
    rule?: string; // For a refusal
};

export type Hello = {
    protocol: number;
    consumer: string;
    access: Access;
    jid: string | null;
};

/**
 * What a method handler gets to reach the connection it was called on.
 */
export type Client = {
    access: Access; // Set by the socket the connection arrived on
    consumer: string | null; // Set by `hello`
    notify(_params: Record<string, unknown>): void; // Sends an `event` notification
};

export type EventFilter = {
    conversation?: string; // Bare JID
    from?: string; // Bare JID
    direction?: 'incoming' | 'outgoing';
    mention?: boolean; // The body names our account
};

export type Subscription = {
    client: Client;
    type: 'message' | 'draft';
    filter: EventFilter;
    once: boolean; // Ends after the first event it sends
};

/**
 * The `event` notifications a client receives once it has subscribed. A draft
 * event is sent to subscribers of type "draft", whatever the draft's action.
 */
export type Event = { subscription: number } & (
    { type: 'message'; message: MessageDTO } | { type: 'draft'; action: 'queued' | 'rejected'; draft: Draft }
);

/**
 * Where a consumer has read up to in one conversation: the last message it
 * has been shown there. `time` is a fallback if that message is no longer
 * stored.
 */
export type Cursor = {
    id: string; // The message's DTO id
    time: string; // ISO 8601
};

export type ConsumerCursors = {
    created: string; // When the consumer was first seen, ISO 8601
    conversations: Record<string, Cursor>; // Keyed by bare JID
};

export type CursorState = {
    consumers: Record<string, ConsumerCursors>;
};

/**
 * A conversation as `conversations.list` shows it, with what's unread for the
 * consumer that asked.
 */
export type ConversationSummary = ConversationDTO & {
    unread: number; // Incoming messages after the consumer's cursor
    last_activity: string | null; // ISO 8601 time of the newest message, of either direction
};

/**
 * The messages `inbox.read` returns for one conversation, oldest first.
 */
export type InboxGroup = {
    conversation: ConversationDTO;
    messages: MessageDTO[];
};

export type Inbox = {
    conversations: InboxGroup[]; // Most recent activity first
};
