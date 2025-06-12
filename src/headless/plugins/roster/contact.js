import { getOpenPromise } from '@converse/openpromise';
import { Model } from '@converse/skeletor';
import '../../plugins/status/api.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import ColorAwareModel from '../../shared/color.js';
import ModelWithVCard from '../../shared/model-with-vcard.js';
import { rejectPresenceSubscription } from './utils.js';

const { Strophe, $pres, stx } = converse.env;

class RosterContact extends ModelWithVCard(ColorAwareModel(Model)) {
    get idAttribute () {
        return 'jid';
    }

    defaults () {
        return {
            groups: [],
            num_unread: 0,
        }
    }

    async initialize (attrs) {
        this.lazy_load_vcard = true;
        super.initialize();
        this.initialized = getOpenPromise();
        await this.setPresence();
        const { jid } = attrs;
        this.set({
            ...attrs,
            ...{
                jid: Strophe.getBareJidFromJid(jid).toLowerCase(),
                user_id: Strophe.getNodeFromJid(jid)
            }
        });
        /**
         * When a contact's presence status has changed.
         * The presence status is either `online`, `offline`, `dnd`, `away` or `xa`.
         * @event _converse#contactPresenceChanged
         * @type {RosterContact}
         * @example _converse.api.listen.on('contactPresenceChanged', contact => { ... });
         */
        this.listenTo(this.presence, 'change:show', () => api.trigger('contactPresenceChanged', this));
        this.listenTo(this.presence, 'change:show', () => this.trigger('presence:change'));
        this.listenTo(this.presence, 'change:presence', () => api.trigger('contactPresenceChanged', this));
        this.listenTo(this.presence, 'change:presence', () => this.trigger('presence:change'));
        /**
         * Synchronous event which provides a hook for further initializing a RosterContact
         * @event _converse#rosterContactInitialized
         * @param {RosterContact} contact
         */
        await api.trigger('rosterContactInitialized', this, {synchronous: true});
        this.initialized.resolve();
    }

    async setPresence () {
        const jid = this.get('jid');
        await api.waitUntil('presencesInitialized');
        const { presences } = _converse.state;
        this.presence = presences.get(jid) || presences.create({ jid });
    }

    getStatus () {
        return this.presence?.getStatus() || 'offline';
    }

    openChat () {
        api.chats.open(this.get('jid'), {}, true);
    }

    /**
     * @param {import('./types').ContactDisplayNameOptions} [options]
     * @returns {string}
     */
    getDisplayName (options) {
        return this.get('nickname') || this.vcard?.getDisplayName() || (options?.no_jid ? null : this.get('jid'));
    }

    /**
     * Send a presence subscription request to this roster contact
     * @param {string} message - An optional message to explain the
     *      reason for the subscription request.
     */
    subscribe (message) {
        api.user.presence.send({
            type: 'subscribe',
            to: this.get('jid'),
            status: message
        });
        this.save('ask', "subscribe"); // ask === 'subscribe' Means we have asked to subscribe to them.
        return this;
    }

    /**
     * Upon receiving the presence stanza of type "subscribed",
     * the user SHOULD acknowledge receipt of that subscription
     * state notification by sending a presence stanza of type
     * "subscribe" to the contact
     */
    ackSubscribe () {
        api.send($pres({
            'type': 'subscribe',
            'to': this.get('jid')
        }));
    }

    /**
     * Upon receiving the presence stanza of type "unsubscribed",
     * the user SHOULD acknowledge receipt of that subscription state
     * notification by sending a presence stanza of type "unsubscribe"
     * this step lets the user's server know that it MUST no longer
     * send notification of the subscription state change to the user.
     */
    ackUnsubscribe () {
        api.send($pres({'type': 'unsubscribe', 'to': this.get('jid')}));
        this.sendRosterRemoveStanza();
        this.destroy();
    }

    /**
     * Unauthorize this contact's presence subscription
     * @param {string} [message] - Optional message to send to the person being unauthorized
     */
    unauthorize (message) {
        rejectPresenceSubscription(this.get('jid'), message);
        this.save({ requesting: false });
        return this;
    }

    /**
     * Authorize presence subscription
     * @param {string} message - Optional message to send to the person being authorized
     */
    authorize (message) {
        api.send(stx`
            <presence
                to="${this.get('jid')}"
                type="subscribed"
                xmlns="jabber:client">
                    ${message && message !== "" ? stx`<status>${message}</status>` : '' }
            </presence>`);

        this.save({
            requesting: false,
            subscription: 'from',
        });
        return this;
    }

    /**
     * Remove this contact from the roster
     * @async
     * @param {boolean} [unauthorize] - Whether to also unauthorize the
     * @returns {Promise<Error|Element>}
     */
    remove (unauthorize) {
        const subscription = this.get('subscription');
        if (subscription === 'none' && this.get('ask') !== 'subscribe') {
            this.destroy();
            return;
        }
        if (this.get('ask') === 'subscribe' || subscription === 'to') {
            // See: https://datatracker.ietf.org/doc/html/rfc6121#section-3.3.1
            api.send($pres({ type: 'unsubscribe',  to: this.get('jid')}));
        }
        if (unauthorize && ['from', 'both'].includes(subscription)) {
            // See: https://datatracker.ietf.org/doc/html/rfc6121#section-3.2.1
            this.unauthorize();
        }
        const promise = this.sendRosterRemoveStanza();
        if (this.collection) this.destroy();

        return promise;
    }

    /**
     * @param {import('./types').RosterContactUpdateAttrs} attrs
     * @returns {Promise}
     */
    async update (attrs) {
        this.save(attrs);
        return await api.sendIQ(
            stx`<iq xmlns="jabber:client" type="set">
                <query xmlns="${Strophe.NS.ROSTER}">
                    <item jid="${this.get("jid")}" name="${this.get("nickname")}">
                        ${this.get("groups")?.map(/** @param {string} group */ (group) => stx`<group>${group}</group>`)}
                    </item>
                </query>
            </iq>`
        );
    }

    /**
     * Instruct the XMPP server to remove this contact from our roster
     * @returns {Promise}
     */
    async sendRosterRemoveStanza () {
        const iq = stx`<iq type="set" xmlns="jabber:client">
            <query xmlns="${Strophe.NS.ROSTER}">
                <item jid="${this.get('jid')}" subscription="remove"/>
            </query>
        </iq>`;
        return await api.sendIQ(iq);
    }

    isUnsaved () {
        return this.get('subscription') === undefined;
    }
}

export default RosterContact;
