import '../../plugins/status/api.js';
import _converse from '../../shared/_converse.js';
import api, { converse } from '../../shared/api/index.js';
import { Model } from '@converse/skeletor';
import { getOpenPromise } from '@converse/openpromise';
import { rejectPresenceSubscription } from './utils.js';

const { Strophe, $iq, $pres } = converse.env;

class RosterContact extends Model {
    get idAttribute () { // eslint-disable-line class-methods-use-this
        return 'jid';
    }

    defaults () { // eslint-disable-line class-methods-use-this
        return {
            'chat_state': undefined,
            'groups': [],
            'image': _converse.DEFAULT_IMAGE,
            'image_type': _converse.DEFAULT_IMAGE_TYPE,
            'num_unread': 0,
            'status': undefined,
        }
    }

    async initialize (attributes) {
        super.initialize();
        this.initialized = getOpenPromise();
        this.setPresence();
        const { jid } = attributes;
        this.set({
            ...attributes,
            ...{
                'jid': Strophe.getBareJidFromJid(jid).toLowerCase(),
                'user_id': Strophe.getNodeFromJid(jid)
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
        this.listenTo(this.presence, 'change:show', () => this.trigger('presenceChanged'));
        /**
         * Synchronous event which provides a hook for further initializing a RosterContact
         * @event _converse#rosterContactInitialized
         * @param {RosterContact} contact
         */
        await api.trigger('rosterContactInitialized', this, {'Synchronous': true});
        this.initialized.resolve();
    }

    setPresence () {
        const jid = this.get('jid');
        const { presences } = _converse.state;
        this.presence = presences.findWhere(jid) || presences.create({ jid });
    }

    openChat () {
        api.chats.open(this.get('jid'), this.attributes, true);
    }

    /**
     * Return a string of tab-separated values that are to be used when
     * matching against filter text.
     *
     * The goal is to be able to filter against the VCard fullname,
     * roster nickname and JID.
     * @returns { String } Lower-cased, tab-separated values
     */
    getFilterCriteria () {
        const nick = this.get('nickname');
        const jid = this.get('jid');
        let criteria = this.getDisplayName();
        criteria = !criteria.includes(jid) ? criteria.concat(`   ${jid}`) : criteria;
        criteria = !criteria.includes(nick) ? criteria.concat(`   ${nick}`) : criteria;
        return criteria.toLowerCase();
    }

    getDisplayName () {
        // Gets overridden in converse-vcard where the fullname is may be returned
        if (this.get('nickname')) {
            return this.get('nickname');
        } else {
            return this.get('jid');
        }
    }

    getFullname () {
        // Gets overridden in converse-vcard where the fullname may be returned
        return this.get('jid');
    }

    /**
     * Send a presence subscription request to this roster contact
     * @method _converse.RosterContacts#subscribe
     * @param { String } message - An optional message to explain the
     *      reason for the subscription request.
     */
    subscribe (message) {
        api.user.presence.send('subscribe', this.get('jid'), message);
        this.save('ask', "subscribe"); // ask === 'subscribe' Means we have asked to subscribe to them.
        return this;
    }

    /**
     * Upon receiving the presence stanza of type "subscribed",
     * the user SHOULD acknowledge receipt of that subscription
     * state notification by sending a presence stanza of type
     * "subscribe" to the contact
     * @method _converse.RosterContacts#ackSubscribe
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
     * @method _converse.RosterContacts#ackUnsubscribe
     */
    ackUnsubscribe () {
        api.send($pres({'type': 'unsubscribe', 'to': this.get('jid')}));
        this.removeFromRoster();
        this.destroy();
    }

    /**
     * Unauthorize this contact's presence subscription
     * @method _converse.RosterContacts#unauthorize
     * @param { String } message - Optional message to send to the person being unauthorized
     */
    unauthorize (message) {
        rejectPresenceSubscription(this.get('jid'), message);
        return this;
    }

    /**
     * Authorize presence subscription
     * @method _converse.RosterContacts#authorize
     * @param { String } message - Optional message to send to the person being authorized
     */
    authorize (message) {
        const pres = $pres({'to': this.get('jid'), 'type': "subscribed"});
        if (message && message !== "") {
            pres.c("status").t(message);
        }
        api.send(pres);
        return this;
    }

    /**
     * Instruct the XMPP server to remove this contact from our roster
     * @method _converse.RosterContacts#removeFromRoster
     * @returns { Promise }
     */
    removeFromRoster () {
        const iq = $iq({type: 'set'})
            .c('query', {xmlns: Strophe.NS.ROSTER})
            .c('item', {jid: this.get('jid'), subscription: "remove"});
        return api.sendIQ(iq);
    }
}

export default RosterContact;
