export default RosterContact;
declare class RosterContact extends Model {
    defaults(): {
        chat_state: any;
        groups: any[];
        image: string;
        image_type: string;
        num_unread: number;
        status: any;
    };
    initialize(attributes: any): Promise<void>;
    initialized: any;
    setPresence(): void;
    presence: any;
    openChat(): void;
    /**
     * Return a string of tab-separated values that are to be used when
     * matching against filter text.
     *
     * The goal is to be able to filter against the VCard fullname,
     * roster nickname and JID.
     * @returns { String } Lower-cased, tab-separated values
     */
    getFilterCriteria(): string;
    getDisplayName(): any;
    getFullname(): any;
    /**
     * Send a presence subscription request to this roster contact
     * @method _converse.RosterContacts#subscribe
     * @param { String } message - An optional message to explain the
     *      reason for the subscription request.
     */
    subscribe(message: string): RosterContact;
    /**
     * Upon receiving the presence stanza of type "subscribed",
     * the user SHOULD acknowledge receipt of that subscription
     * state notification by sending a presence stanza of type
     * "subscribe" to the contact
     * @method _converse.RosterContacts#ackSubscribe
     */
    ackSubscribe(): void;
    /**
     * Upon receiving the presence stanza of type "unsubscribed",
     * the user SHOULD acknowledge receipt of that subscription state
     * notification by sending a presence stanza of type "unsubscribe"
     * this step lets the user's server know that it MUST no longer
     * send notification of the subscription state change to the user.
     * @method _converse.RosterContacts#ackUnsubscribe
     */
    ackUnsubscribe(): void;
    /**
     * Unauthorize this contact's presence subscription
     * @method _converse.RosterContacts#unauthorize
     * @param { String } message - Optional message to send to the person being unauthorized
     */
    unauthorize(message: string): RosterContact;
    /**
     * Authorize presence subscription
     * @method _converse.RosterContacts#authorize
     * @param { String } message - Optional message to send to the person being authorized
     */
    authorize(message: string): RosterContact;
    /**
     * Instruct the XMPP server to remove this contact from our roster
     * @method _converse.RosterContacts#removeFromRoster
     * @returns { Promise }
     */
    removeFromRoster(): Promise<any>;
}
import { Model } from "@converse/skeletor";
//# sourceMappingURL=contact.d.ts.map