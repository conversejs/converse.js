export default RosterContact;
declare const RosterContact_base: (new (attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions) => Model<import("@converse/skeletor").ModelAttributes>) & import("../../shared/types.js").Constructor<import("../../shared/types.js").ColorAware> & import("../../shared/types.js").Constructor<import("../../shared/types.js").VCardAware>;
declare class RosterContact extends RosterContact_base {
    defaults(): {
        groups: any[];
        num_unread: number;
    };
    initialize(attrs: any): void;
    initialized: Promise<void>;
    setup(attrs: any): Promise<void>;
    setPresence(): Promise<void>;
    presence: any;
    getStatus(): any;
    /**
     * Whether this contact receives our presence, i.e. a subscription of
     * 'from' or 'both' (RFC 6121 § 3).
     * @returns {boolean}
     */
    seesOurPresence(): boolean;
    openChat(): Promise<any>;
    /**
     * @param {import('./types').ContactDisplayNameOptions} [options]
     * @returns {string}
     */
    getDisplayName(options?: import("./types").ContactDisplayNameOptions): string;
    /**
     * Send a presence subscription request to this roster contact
     * @param {string} [message] - An optional message to explain the
     *      reason for the subscription request.
     */
    subscribeToPresence(message?: string): this;
    /**
     * Upon receiving the presence stanza of type "subscribed",
     * the user SHOULD acknowledge receipt of that subscription
     * state notification by sending a presence stanza of type
     * "subscribe" to the contact
     */
    ackSubscribe(): void;
    /**
     * Upon receiving the presence stanza of type "unsubscribed",
     * the user SHOULD acknowledge receipt of that subscription state
     * notification by sending a presence stanza of type "unsubscribe"
     * this step lets the user's server know that it MUST no longer
     * send notification of the subscription state change to the user.
     */
    ackUnsubscribe(): void;
    /**
     * Unauthorize this contact's presence subscription
     * @param {string} [message] - Optional message to send to the person being unauthorized
     */
    unauthorize(message?: string): this;
    /**
     * Authorize presence subscription
     * @param {string} [message] - Optional message to send to the person being authorized
     */
    authorize(message?: string): this;
    /**
     * Remove this contact from the roster
     * @param {boolean} [unauthorize] - Whether to also unauthorize the
     * @returns {Promise<Error|Element>}
     */
    remove(unauthorize?: boolean): Promise<Error | Element>;
    /**
     * @param {import('./types').RosterContactUpdateAttrs} attrs
     * @returns {Promise}
     */
    update(attrs: import("./types").RosterContactUpdateAttrs): Promise<any>;
    /**
     * Instruct the XMPP server to remove this contact from our roster
     * @returns {Promise}
     */
    sendRosterRemoveStanza(): Promise<any>;
    isUnsaved(): boolean;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=contact.d.ts.map