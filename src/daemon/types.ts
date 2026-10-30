export type Paths = {
    config: string; // The account configuration file
    runtime_dir: string; // Owner-only directory holding the full access socket and the pidfile
    socket: string; // Full access
    restricted_dir: string; // The restricted socket's own directory, so a sandbox can be given it alone
    restricted_socket: string; // Restricted access
    pidfile: string;
    record: string; // The running daemon's record, under the account's name: see DaemonRecord
    storage: string | null; // The headless database's directory. Null leaves it to headless, for daemon.json
    log: string; // Where an auto-spawned daemon writes its output
    cursors: string; // Each consumer's read cursors
    audit: string; // Every send, draft and refusal, one JSON line each
    drafts: string; // Drafts not yet sent or withdrawn, and the id each was given
    rooms: string; // The rooms the daemon is meant to be in, and the nickname it uses in each
};

// A configured account: daemon.json, or a file in the accounts directory.
export type Account = {
    name: string; // "default" for daemon.json, else the file's name without ".json"
    config: string; // The config file
    default: boolean; // Whether it's used when no account is named
};

// What a running daemon leaves in the runtime directory, so that clients find it by its account's name.
export type DaemonRecord = {
    account: string;
    jid: string; // The bare JID it was started with, which the config may since have changed
    pid: number;
    started: string; // ISO 8601
    socket: string;
    restricted_socket: string;
    pidfile: string;
    log: string;
};

/**
 * What a connection may do. Full is the user's own access; restricted is what
 * agents get. The level is fixed by the socket a connection arrives on.
 */
export type Access = 'full' | 'restricted';

/**
 * How the account acts. "owner_only": restricted sends are drafts for the owner,
 * and direct only to the owner. "bot": restricted sends also go out directly to
 * the rooms and contacts the policy lists. "as_user": the account is the user's
 * own, and every restricted send is a draft, held until the user approves it.
 */
export type Mode = 'owner_only' | 'bot' | 'as_user';

/**
 * How a restricted send went: sent by the account itself, or queued for the owner.
 */
export type Route = 'direct' | 'draft';

/**
 * Where a restricted send went, as recorded in the audit log.
 */
export type Routing = { route: Route; mode: Mode };

export type Policy = {
    allow: string[]; // Bare JIDs that restricted sends may be drafted for
    direct: string[]; // Bare JIDs that restricted sends may go to directly, in "bot" mode
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
    account: string; // The account's name
    jid: string; // Bare JID of the agent's account, which is the user's own in "as_user" mode
    owner: string; // Bare JID of the user, to whom drafts are delivered. The same as jid in "as_user" mode
    password?: string; // Unset means: look in the system keyring
    websocket_url?: string;
    resource: string;
    consumer: string; // The name a client identifies itself by unless told otherwise
    access: Access; // The level the CLI connects at
    mode: Mode; // How the account acts, see Mode
    // Whether the owner may send a failed send again in the clear. Off unless the config says so.
    allow_unencrypted_resend: boolean;
    // The group, by name or number, that may reach the restricted socket. Unset keeps it owner-only.
    socket_group: string | null;
    // The sockets a client reaches the daemon on, when the config names them. Null for the derived ones.
    sockets: Sockets | null;
    policy: Policy;
    settings: Record<string, unknown>; // Passed through to converse.initialize
    paths: Paths;
};

/**
 * Sockets the config names, for a client that reaches a daemon running on
 * another host, such as through an SSH socket forward. The daemon never
 * listens on them, and a client never starts a daemon for them.
 */
export type Sockets = {
    socket: string | null; // Full access, null if the config names only the restricted socket
    restricted_socket: string | null; // Restricted access, null if the config names only the full one
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

// How a message was encrypted. Only OMEMO (XEP-0384) so far.
export type Encryption = {
    scheme: 'omemo';
    status: 'decrypted' | 'undecryptable';
    error: string | null; // Why it couldn't be decrypted, for the user to read
};

// One of a conversation's OMEMO devices, or one of the account's own.
export type DeviceDTO = {
    id: string;
    this_device: boolean; // Whether this is the daemon's own device
    active: boolean; // Whether messages are encrypted for it
    trust: 'trusted' | 'untrusted' | 'undecided';
    fingerprint: string | null; // Hex of its identity key, or null if its bundle couldn't be fetched
};

export type DeviceList = {
    conversation: string; // Bare JID
    encrypted: boolean; // Whether OMEMO is on for the conversation, so that sends are encrypted
    devices: DeviceDTO[];
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
    // Untrusted: written by whoever sent the message. A reply's quote of what
    // it answers, kept for clients that don't know replies, is left out.
    body: string | null;
    // How the message was encrypted, or null if it wasn't. An undecryptable
    // message has a null body, and its error says why.
    encryption: Encryption | null;
    // The message this one replies to (XEP-0461): its id as above if we hold
    // it, else the id the reply gave.
    reply_to: string | null;
    // When the message was last corrected (XEP-0308), ISO 8601. The body is the
    // corrected text. The id may then change, but the old one still finds it.
    edited: string | null;
    // When the message was retracted (XEP-0424), by its sender or a room's
    // moderator, ISO 8601. The body of a retracted message is null.
    retracted: string | null;
    // The reactions to the message (XEP-0444): for each emoji, who reacted with
    // it. A reactor is named like `from`: a bare JID in a chat, an occupant JID
    // in a room, or the room's opaque occupant id if the occupant isn't known.
    reactions: Record<string, string[]>;
    // "received" for a message from someone else, "sent" for one of ours that
    // went out, and "failed" for one of ours that didn't. A failed send stays in
    // the history, but it isn't counted in the inbox, unread counts or activity.
    status: 'received' | 'sent' | 'failed';
    // Why a failed send failed, as headless names it, such as "no-omemo-devices".
    // Null for any other message.
    error_code: string | null;
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
 * The messages a search found. "server" means the server's own full-text
 * search of its archive (XEP-0431); "local" means the messages held locally,
 * which is where the search goes when the server can't, or fails.
 */
export type SearchResult = {
    method: 'server' | 'local';
    messages: MessageDTO[]; // Oldest first, each naming its conversation
};

/**
 * A send the agent asked for that didn't go to its recipient. In "owner_only"
 * and "bot" modes it went to the owner as text, and the owner sends it
 * themselves, from their own client, or doesn't. In "as_user" mode it's held
 * in the daemon until the user sends it with `drafts.send`, or withdraws it.
 * Only "as_user" drafts corrections, retractions and withdrawn reactions.
 */
export type Draft = {
    id: string; // Short, and unique for the account, e.g. "d17"
    to: string; // Bare JID
    body: string | null; // Untrusted: written by the consumer that queued it. Null for a retraction
    consumer: string | null; // Who queued it
    created: string; // ISO 8601
    reply_to: string | null; // The id of the message it's meant to reply to
    reaction_to: string | null; // For a reaction, the id of the message reacted to. The body is the emoji.
    correct: string | null; // The id of our message it's meant to replace
    retract: string | null; // The id of our message it's meant to retract
    remove: boolean; // For a reaction, whether it withdraws the emoji rather than giving it
    upload: boolean; // Whether the body is the URL of an uploaded file, to be shared as one
};

/**
 * What a send came to. A refused send says which rule refused it, and what to
 * do about it. A draft was not sent: in "owner_only" and "bot" modes its text
 * went to the owner, and in "as_user" mode it waits for the user's approval.
 */
export type SendResult =
    | { outcome: 'sent'; message: MessageDTO }
    | { outcome: 'scheduled'; schedule: ScheduleDTO }
    | {
          outcome: 'refused';
          rule: 'allowlist' | 'rate_conversation' | 'room_allowlist' | 'rate_room' | 'rate_overall';
          message: string;
      }
    | { outcome: 'draft'; draft_id: string };

export type ScheduleDTO = {
    id: string;
    to: string;
    body: string; // Untrusted: written by the consumer that scheduled it
    send_at: string; // ISO 8601
    created: string; // ISO 8601
    consumer: string | null;
    access: Access;
    reply_to: string | null;
    correct: string | null;
    /** Set when policy refused the send at due time. The message is kept, not sent. */
    parked: (Extract<SendResult, { outcome: 'refused' }> & { at: string }) | null;
};

/**
 * An entry in the audit log. The body of a message isn't recorded.
 */
export type AuditEntry = {
    consumer: string | null;
    to: string; // Bare JID
    outcome: 'sent' | 'refused' | 'draft' | 'rejected';
    id?: string; // The DTO id, for a send
    draft?: string; // The draft's id, for a draft, a rejection, or a draft sent on approval
    approved_by?: Access; // For a draft sent on approval ("as_user" mode): the access level that approved it
    rule?: string; // For a refusal
    action?: 'reply' | 'correct' | 'retract' | 'react' | 'upload' | 'resend';
    target?: string; // The id of the message acted on
    mode?: Mode; // For a restricted send, a refusal of one, or a draft's rejection or approval
    route?: Route; // For a restricted send that was sent or drafted, and a draft's rejection or approval
    unencrypted?: boolean; // For a resend of a failed send in the clear
};

export type Hello = {
    protocol: number;
    consumer: string;
    access: Access;
    mode: Mode; // How the account acts, for a client without the config
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
    { type: 'message'; message: MessageDTO } | { type: 'draft'; action: 'queued' | 'sent' | 'rejected'; draft: Draft }
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
