import isNaN from 'lodash-es/isNaN';
import isObject from 'lodash-es/isObject';
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api, converse } from '@converse/headless/core';

const { Strophe, $pres } = converse.env;

export default class XMPPStatus extends Model {

    defaults () { // eslint-disable-line class-methods-use-this
        return { "status":  api.settings.get("default_state") }
    }

    initialize () {
        this.on('change', item => {
            if (!isObject(item.changed)) {
                return;
            }
            if ('status' in item.changed || 'status_message' in item.changed) {
                api.user.presence.send(this.get('status'), null, this.get('status_message'));
            }
        });
    }

    getDisplayName () {
        return this.getFullname() || this.getNickname() || _converse.bare_jid;
    }

    getNickname () { // eslint-disable-line class-methods-use-this
        return api.settings.get('nickname');
    }

    getFullname () { // eslint-disable-line class-methods-use-this
        return ''; // Gets overridden in converse-vcard
    }

    /** Constructs a presence stanza
     * @param { string } [type]
     * @param { string } [to] - The JID to which this presence should be sent
     * @param { string } [status_message]
     */
    async constructPresence (type, to=null, status_message) {
        type = typeof type === 'string' ? type : (this.get('status') || api.settings.get("default_state"));
        status_message = typeof status_message === 'string' ? status_message : this.get('status_message');

        let presence;

        if (type === 'subscribe') {
            presence = $pres({ to, type });
            const { xmppstatus } = _converse;
            const nick = xmppstatus.getNickname();
            if (nick) presence.c('nick', {'xmlns': Strophe.NS.NICK}).t(nick).up();

        } else if ((type === 'unavailable') ||
                (type === 'probe') ||
                (type === 'error') ||
                (type === 'unsubscribe') ||
                (type === 'unsubscribed') ||
                (type === 'subscribed')) {
            presence = $pres({ to, type });

        } else if (type === 'offline') {
            presence = $pres({ to, type: 'unavailable' });

        } else if (type === 'online') {
            presence = $pres({ to });

        } else {
            presence = $pres({ to }).c('show').t(type).up();
        }

        if (status_message) presence.c('status').t(status_message).up();

        const priority = api.settings.get("priority");
        presence.c('priority').t(isNaN(Number(priority)) ? 0 : priority).up();

        const { idle, idle_seconds } = _converse;
        if (idle) {
            const idle_since = new Date();
            idle_since.setSeconds(idle_since.getSeconds() - idle_seconds);
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
