export type ConnectionStatus = 'online' | 'unavailable' | 'offline';
export type ProfileShow = 'dnd' | 'away' | 'xa' | 'chat';
export type PresenceAttrs = {
    type?: PresenceType;
    to?: string;
    status?: string;
    show?: string;
};
type PresenceType = 'error' | 'offline' | 'online' | 'probe' | 'subscribe' | 'unavailable' | 'unsubscribe' | 'unsubscribed';
export type IdleStatus = {
    idle?: boolean;
    seconds?: number;
};
export {};
//# sourceMappingURL=types.d.ts.map