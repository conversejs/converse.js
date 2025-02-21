import { Model } from '@converse/skeletor';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import ModelWithVCard from '../../shared/model-with-vcard';
import ColorAwareModel from '../../shared/color.js';
import { isIdle, getIdleSeconds } from './utils.js';

const { Strophe, $pres } = converse.env;

export default class XMPPStatus extends ModelWithVCard(ColorAwareModel(Model)) {

    defaults() {
        return { status: api.settings.get('default_state') };
    }

    getStatus() {
        return this.get('status');
    }

    /**
     * @param {string} attr
     */
    get(attr) {
        if (attr === 'jid') {
            return _converse.session.get('bare_jid');
        } else if (attr === 'nickname') {
            return api.settings.get('nickname');
        }
        return super.get(attr);
    }

    /**
     * @param {string|Object} key
     * @param {string|Object} [val]
     * @param {Object} [options]
     */
    set(key, val, options) {
        if (key === 'jid' || key === 'nickname') {
            throw new Error('Readonly property');
        }
        return super.set(key, val, options);
    }

    initialize() {
        super.initialize();
        this.on('change', (item) => {
            if (!(item.changed instanceof Object)) {
                return;
            }
            if ('status' in item.changed || 'status_message' in item.changed) {
                api.user.presence.send(this.get('status'), null, this.get('status_message'));
            }
        });
    }

    getDisplayName() {
        return this.vcard?.get('fullname') || this.getNickname() || this.get('jid');
    }

    getNickname() {
        return this.vcard?.get('nickname') || api.settings.get('nickname');
    }

    /** Constructs a presence stanza
     * @param {string} [type]
     * @param {string} [to] - The JID to which this presence should be sent
     * @param {string} [status_message]
     */
    async constructPresence(type, to = null, status_message) {
        type = typeof type === 'string' ? type : this.get('status') || api.settings.get('default_state');
        status_message = typeof status_message === 'string' ? status_message : this.get('status_message');

        let presence;

        if (type === 'subscribe') {
            presence = $pres({ to, type });
            const { xmppstatus } = _converse.state;
            const nick = xmppstatus.getNickname();
            if (nick) presence.c('nick', { 'xmlns': Strophe.NS.NICK }).t(nick).up();
        } else if (
            type === 'unavailable' ||
            type === 'probe' ||
            type === 'error' ||
            type === 'unsubscribe' ||
            type === 'unsubscribed' ||
            type === 'subscribed'
        ) {
            presence = $pres({ to, type });
        } else if (type === 'offline') {
            presence = $pres({ to, type: 'unavailable' });
        } else if (type === 'online') {
            presence = $pres({ to });
        } else {
            presence = $pres({ to }).c('show').t(type).up();
        }

        if (status_message) presence.c('status').t(status_message).up();

        const priority = api.settings.get('priority');
        presence
            .c('priority')
            .t(Number.isNaN(Number(priority)) ? 0 : priority)
            .up();

        if (isIdle()) {
            const idle_since = new Date();
            idle_since.setSeconds(idle_since.getSeconds() - getIdleSeconds());
            presence.c('idle', { xmlns: Strophe.NS.IDLE, since: idle_since.toISOString() });
        }

        /**
         * *Hook* which allows plugins to modify a presence stanza
         * @event _converse#constructedPresence
         */
        presence = await api.hook('constructedPresence', null, presence);
        return presence;
    }
}
