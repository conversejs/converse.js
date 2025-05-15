export type PresenceTypes = null | 'available' | 'unavailable' | 'error' | 'probe' | 'subscribe' | 'subscribed' | 'unsubscribe' | 'unsubscribed';
export type PresenceShowValues = 'chat' | 'away' | 'dnd' | 'xa';
export type Presence = {
    resource: string;
    type: PresenceTypes;
    priority: Number;
    show?: PresenceShowValues;
    timestamp: string;
};
export type RosterContactUpdateAttrs = {
    nickname?: string;
    groups?: string[];
};
export type RosterContactAttributes = {
    jid: string;
    subscription: 'none' | 'to' | 'from' | 'both';
    ask?: 'subscribe';
    name?: string;
    groups?: string[];
    requesting?: boolean;
};
export type ContactDisplayNameOptions = {
    no_jid?: boolean;
    context?: 'roster';
};
//# sourceMappingURL=types.d.ts.map