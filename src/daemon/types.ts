export type Paths = {
    config: string; // The account configuration file
    runtime_dir: string; // Owner-only directory holding the socket and pidfile
    socket: string;
    pidfile: string;
    log: string; // Where an auto-spawned daemon writes its output
};

export type Config = {
    jid: string; // Bare JID of the account
    password?: string; // Unset means: look in the system keyring
    websocket_url?: string;
    resource: string;
    consumer: string; // The name a client identifies itself by unless told otherwise
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

export type SendResult = {
    outcome: 'sent';
    message: MessageDTO;
};

export type Hello = {
    protocol: number;
    consumer: string;
    access: 'full';
    jid: string | null;
};

/**
 * What a method handler gets to reach the connection it was called on.
 */
export type Client = {
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
    filter: EventFilter;
    once: boolean; // Ends after the first event it sends
};

/**
 * The `event` notifications a client receives once it has subscribed.
 */
export type Event = {
    subscription: number;
    type: 'message';
    message: MessageDTO;
};
