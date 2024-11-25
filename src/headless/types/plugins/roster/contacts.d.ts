export default RosterContacts;
declare class RosterContacts extends Collection {
    constructor();
    model: typeof RosterContact;
    data: any;
    state: Model;
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
    subscribeToSuggestedItems(msg: any): boolean;
    isSelf(jid: any): any;
    /**
     * Add a roster contact and then once we have confirmation from
     * the XMPP server we subscribe to that contact's presence updates.
     * @method _converse.RosterContacts#addAndSubscribe
     * @param { String } jid - The Jabber ID of the user being added and subscribed to.
     * @param { String } name - The name of that user
     * @param { Array<String> } groups - Any roster groups the user might belong to
     * @param { String } message - An optional message to explain the reason for the subscription request.
     * @param { Object } attributes - Any additional attributes to be stored on the user's model.
     */
    addAndSubscribe(jid: string, name: string, groups: Array<string>, message: string, attributes: any): Promise<void>;
    /**
     * Send an IQ stanza to the XMPP server to add a new roster contact.
     * @method _converse.RosterContacts#sendContactAddIQ
     * @param { String } jid - The Jabber ID of the user being added
     * @param { String } name - The name of that user
     * @param { Array<String> } groups - Any roster groups the user might belong to
     */
    sendContactAddIQ(jid: string, name: string, groups: Array<string>): any;
    /**
     * Adds a RosterContact instance to _converse.roster and
     * registers the contact on the XMPP server.
     * Returns a promise which is resolved once the XMPP server has responded.
     * @method _converse.RosterContacts#addContactToRoster
     * @param {String} jid - The Jabber ID of the user being added and subscribed to.
     * @param {String} name - The name of that user
     * @param {Array<String>} groups - Any roster groups the user might belong to
     * @param {Object} attributes - Any additional attributes to be stored on the user's model.
     */
    addContactToRoster(jid: string, name: string, groups: Array<string>, attributes: any): Promise<any>;
    /**
     * @param {String} bare_jid
     * @param {Element} presence
     */
    subscribeBack(bare_jid: string, presence: Element): Promise<void>;
    /**
     * Handle roster updates from the XMPP server.
     * See: https://xmpp.org/rfcs/rfc6121.html#roster-syntax-actions-push
     * @method _converse.RosterContacts#onRosterPush
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
    createRequestingContact(presence: any): void;
    handleIncomingSubscription(presence: any): void;
    handleOwnPresence(presence: any): void;
    presenceHandler(presence: any): true | void;
}
import { Collection } from "@converse/skeletor";
import RosterContact from './contact.js';
import { Model } from "@converse/skeletor";
//# sourceMappingURL=contacts.d.ts.map