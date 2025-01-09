export default RosterContacts;
declare class RosterContacts extends Collection {
    constructor();
    model: typeof RosterContact;
    data: any;
    state: Model;
    /**
     * @param {import('../../shared/chatbox').default} model
     */
    onChatBoxClosed(model: import("../../shared/chatbox").default): void;
    onConnected(): void;
    /**
     * Register a handler for roster IQ "set" stanzas, which update
     * roster contacts.
     */
    registerRosterHandler(): void;
    /**
     * Register a handler for RosterX message stanzas, which are
     * used to suggest roster contacts to a user.
     */
    registerRosterXHandler(): void;
    /**
     * Fetches the roster contacts, first by trying the browser cache,
     * and if that's empty, then by querying the XMPP server.
     * @returns {promise} Promise which resolves once the contacts have been fetched.
     */
    fetchRosterContacts(): Promise<any>;
    /**
     * @param {Element} msg
     */
    subscribeToSuggestedItems(msg: Element): boolean;
    /**
     * @param {string} jid
     */
    isSelf(jid: string): any;
    /**
     * Send an IQ stanza to the XMPP server to add a new roster contact.
     * @param {import('./types.ts').RosterContactAttributes} attributes
     */
    sendContactAddIQ(attributes: import("./types.ts").RosterContactAttributes): any;
    /**
     * Adds a {@link RosterContact} instance to {@link RosterContacts} and
     * optionally (if subscribe=true) subscribe to the contact's presence
     * updates which also adds the contact to the roster on the XMPP server.
     * @param {import('./types.ts').RosterContactAttributes} attributes
     * @param {boolean} [persist=true] - Whether the contact should be persisted to the user's roster.
     * @param {boolean} [subscribe=true] - Whether we should subscribe to the contacts presence updates.
     * @param {string} [message=''] - An optional message to include with the presence subscription
     * @returns {Promise<RosterContact>}
     */
    addContact(attributes: import("./types.ts").RosterContactAttributes, persist?: boolean, subscribe?: boolean, message?: string): Promise<RosterContact>;
    /**
     * @param {string} bare_jid
     * @param {Element} presence
     * @param {string} [auth_msg=''] - Optional message to be included in the
     *   authorization of the contacts subscription request.
     * @param {string} [sub_msg=''] - Optional message to be included in our
     *   reciprocal subscription request.
     */
    subscribeBack(bare_jid: string, presence: Element, auth_msg?: string, sub_msg?: string): Promise<void>;
    /**
     * Handle roster updates from the XMPP server.
     * See: https://xmpp.org/rfcs/rfc6121.html#roster-syntax-actions-push
     * @param { Element } iq - The IQ stanza received from the XMPP server.
     */
    onRosterPush(iq: Element): void;
    rosterVersioningSupported(): any;
    /**
     * Fetch the roster from the XMPP server
     * @emits _converse#roster
     * @returns {promise}
     */
    fetchFromServer(): Promise<any>;
    /**
     * Update or create RosterContact models based on the given `item` XML
     * node received in the resulting IQ stanza from the server.
     * @param { Element } item
     */
    updateContact(item: Element): any;
    /**
     * @param {Element} presence
     */
    createRequestingContact(presence: Element): void;
    /**
     * @param {Element} presence
     */
    handleIncomingSubscription(presence: Element): void;
    /**
     * @param {Element} presence
     */
    handleOwnPresence(presence: Element): void;
    /**
     * @param {Element} presence
     */
    presenceHandler(presence: Element): true | void;
}
import { Collection } from "@converse/skeletor";
import RosterContact from './contact.js';
import { Model } from "@converse/skeletor";
//# sourceMappingURL=contacts.d.ts.map