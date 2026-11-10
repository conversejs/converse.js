export type ConnectionStatus = 'online' | 'unavailable' | 'offline';

export type PresenceAttrs = {
    type?: PresenceType;
    to?: string;
    status?: string;
    show?: string;
};

type PresenceType =
    | 'error'
    | 'offline'
    | 'online'
    | 'probe'
    | 'subscribe'
    | 'unavailable'
    | 'unsubscribe'
    | 'unsubscribed';

export type IdleStatus = {
    idle?: boolean;
    seconds?: number;
};
