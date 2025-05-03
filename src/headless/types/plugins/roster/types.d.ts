export type RosterContactUpdateAttrs = {
    nickname?: string;
    groups?: string[];
};
export type RosterContactAttributes = {
    jid: string;
    subscription: ('none' | 'to' | 'from' | 'both');
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