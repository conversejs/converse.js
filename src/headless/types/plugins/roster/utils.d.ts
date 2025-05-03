export function unregisterPresenceHandler(): void;
/**
 * Roster specific event handler for the clearSession event
 */
export function onClearSession(): Promise<void>;
/**
 * Roster specific event handler for the presencesInitialized event
 * @param {Boolean} reconnecting
 */
export function onPresencesInitialized(reconnecting: boolean): void;
/**
 * Roster specific event handler for the statusInitialized event
 * @param { Boolean } reconnecting
 */
export function onStatusInitialized(reconnecting: boolean): Promise<void>;
/**
 * Roster specific event handler for the chatBoxesInitialized event
 */
export function onChatBoxesInitialized(): void;
/**
 * Roster specific handler for the rosterContactsFetched promise
 */
export function onRosterContactsFetched(): void;
/**
 * Reject or cancel another user's subscription to our presence updates.
 * @function rejectPresenceSubscription
 * @param {String} jid - The Jabber ID of the user whose subscription is being canceled
 * @param {String} [message] - An optional message to the user
 */
export function rejectPresenceSubscription(jid: string, message?: string): void;
/**
 * @param {import('./contact.js').default} contact
 * @return {boolean}
 */
export function isUnsavedContact(contact: import("./contact.js").default): boolean;
export type RosterContacts = import("./contacts").default;
//# sourceMappingURL=utils.d.ts.map