export type PresenceTypes =
    | null
    | 'available'
    | 'unavailable'
    | 'error'
    | 'probe'
    | 'subscribe'
    | 'subscribed'
    | 'unsubscribe'
    | 'unsubscribed';
export type PresenceShowValues = 'chat' | 'away' | 'dnd' | 'xa';

export type Presence = {
    resource: string;
    type: PresenceTypes;
    priority: Number;
    show?: PresenceShowValues;
    timestamp: string;
};

export type RosterContactUpdateAttrs = {
    nickname?: string; // The name of that user
    groups?: string[]; // Any roster groups the user might belong to
};

export type RosterContactAttributes = {
    jid: string;
    subscription: 'none' | 'to' | 'from' | 'both';
    ask?: 'subscribe'; // The Jabber ID of the user being added and subscribed to
    name?: string; // The name of that user
    groups?: string[]; // Any roster groups the user might belong to
    requesting?: boolean;
};

export type ContactDisplayNameOptions = {
    no_jid?: boolean; // If true, null will be returned instead of the JID
    context?: 'roster'; // The context in which the display name is being requested
};
