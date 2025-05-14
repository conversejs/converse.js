export type connection_status = 'online' | 'unavailable' | 'offline';
export type profile_show = 'dnd' | 'away' | 'xa' | 'chat';
export type presence_attrs = {
    type?: presence_type;
    to?: string;
    status?: string;
    show?: string;
};
export type presence_type = 'error' | 'offline' | 'online' | 'probe' | 'subscribe' | 'unavailable' | 'unsubscribe' | 'unsubscribed';
//# sourceMappingURL=types.d.ts.map