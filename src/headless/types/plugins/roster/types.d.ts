import { ModelAttributes } from "@converse/skeletor";
export type PresenceTypes = null | 'available' | 'unavailable' | 'error' | 'probe' | 'subscribe' | 'subscribed' | 'unsubscribe' | 'unsubscribed';
export type PresenceShowValues = 'chat' | 'away' | 'dnd' | 'xa';
export type Presence = {
    resource: string;
    type: PresenceTypes;
    priority: Number;
    show?: PresenceShowValues;
    timestamp: string;
};
export type PresenceAttrs = ModelAttributes & {
    jid?: string;
    presence: PresenceTypes | 'offline';
    show?: string;
};
export type RosterContactUpdateAttrs = {
    nickname?: string;
    groups?: string[];
};
/**
 * There are four primary presence subscription states (these states are
 * described from the perspective of the user, not the contact):
 *
 * none: The user does not have a subscription to the contact's
 *     presence, and the contact does not have a subscription to the
 *     user's presence.
 *
 * to: The user has a subscription to the contact's presence, but the
 *     contact does not have a subscription to the user's presence.
 *
 * from: The contact has a subscription to the user's presence, but the
 *     user does not have a subscription to the contact's presence.
 *
 * both: Both the user and the contact have subscriptions to each
 *     other's presence (i.e. the union of 'from' and 'to').
 */
export type subscriptionState = 'none' | 'to' | 'from' | 'both';
export type RosterContactAttributes = {
    jid: string;
    subscription: subscriptionState;
    ask?: 'subscribe';
    name?: string;
    groups?: string[];
    requesting?: boolean;
};
export type ContactDisplayNameOptions = {
    no_jid?: boolean;
    context?: 'roster';
};
export type ContactsStateAttrs = ModelAttributes & {
    collapsed_groups: string[];
};
//# sourceMappingURL=types.d.ts.map