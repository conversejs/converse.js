export type RosterContactUpdateAttrs = {
    nickname?: string; // The name of that user
    groups?: string[]; // Any roster groups the user might belong to
}

export type RosterContactAttributes = {
    jid: string;
    subscription: ('none'|'to'|'from'|'both');
    ask?: 'subscribe'; // The Jabber ID of the user being added and subscribed to
    name?: string; // The name of that user
    groups?: string[]; // Any roster groups the user might belong to
    requesting?: boolean;
}

export type ContactDisplayNameOptions = {
    no_jid?: boolean; // If true, null will be returned instead of the JID
    context?: 'roster'; // The context in which the display name is being requested
}
