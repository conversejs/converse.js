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
    rooms: string; // The rooms the daemon is meant to be in, and the nickname it uses in each
};

/**
 * What a connection may do. Full is the user's own access; restricted is what
 * agents get. The level is fixed by the socket a connection arrives on.
 */
export type Access = 'full' | 'restricted';

export type Policy = {
    allow: string[]; // Bare JIDs that restricted sends may be drafted for
    rooms: string[]; // Bare JIDs of rooms that restricted access may send to, and join or leave
    rate_limit: {
        per_conversation: number; // Restricted sends to one contact per window
        per_room: number; // Restricted sends to one room per window
        overall: number; // Restricted sends to anyone per window
        window: number; // Seconds
    };
    presence: boolean; // Whether restricted access may change our presence
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
    type: 'chat' | 'groupchat'; // A groupchat is a MUC room
    name: string | null; // The roster name for a contact, or the room's name for a room
};

export type MessageDTO = {
    // The server's stanza-id (XEP-0359) if it assigned one, else the
    // origin-id, else the stanza's id attribute. Commands that target a
    // message accept any of the three, or a unique prefix of this one.
    id: string;
    conversation: string; // Bare JID
    // In a chat, the sender's bare JID. In a room, the sender's occupant JID,
    // the room's JID with the sender's nickname as resource.
    from: string;
    nick: string | null; // In a room, the sender's nickname; null in a chat
    direction: 'incoming' | 'outgoing';
    time: string; // ISO 8601
    body: string | null; // Untrusted: written by whoever sent the message
};

/**
 * Someone in a room, as `rooms.occupants` shows them.
 */
export type OccupantDTO = {
    nick: string;
    jid: string | null; // Their bare JID, when the room reveals it
    role: string; // "moderator", "participant", "visitor" or "none"
    affiliation: string; // "owner", "admin", "member", "outcast" or "none"
};

/**
 * A room the daemon has joined, or a room on a service, as `rooms.discover` lists it.
 */
export type RoomListing = {
    jid: string;
    name: string | null;
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
          rule: 'allowlist' | 'rate_conversation' | 'room_allowlist' | 'rate_room' | 'rate_overall';
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
    mention?: boolean; // The body names us: by our nickname in a room, else by our JID's name
};

/**
 * What the from and mention filters are matched against, which a message's
 * DTO doesn't carry for a room.
 */
export type EventSender = {
    sender: string | null; // The sender's bare JID. In a room, null unless the room reveals it.
    own_name: string | null; // The name we're addressed by: our nickname in a room, else our JID's name
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

/**
 * A roster contact as `contacts.list` shows it.
 */
export type ContactSummary = {
    jid: string; // Bare JID
    name: string | null; // The roster nickname, or the vCard name. Set by the contact, so untrusted
    presence: string; // "online", "chat", "away", "xa", "dnd" or "offline", from the contact's best resource
};

/**
 * A client a contact is connected with, as `contacts.whois` shows it.
 */
export type ResourceDTO = {
    name: string; // The resource, e.g. "mobile"
    presence: string; // As ContactSummary.presence, for this resource alone
    priority: number;
    status: string | null; // The resource's status message. Untrusted
    identities: { category: string; type: string; name: string | null }[]; // From disco#info, empty if it didn't answer
};

/**
 * What `contacts.whois` knows about a JID. Any JID is accepted, not only
 * roster contacts, so `on_roster` says which this is.
 */
export type ContactDetails = {
    jid: string;
    name: string | null;
    on_roster: boolean;
    presence: string;
    vcard: {
        fullname: string | null; // Untrusted, like everything in a vCard
        nickname: string | null;
        email: string | null;
        url: string | null;
        role: string | null;
    } | null; // Null if the vCard couldn't be fetched
    resources: ResourceDTO[];
};

/**
 * Our own presence, as `presence.set` leaves it.
 */
export type PresenceDTO = {
    show: string; // "online", "chat", "away", "xa" or "dnd"
    status_message: string | null;
};
