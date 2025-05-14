import { Model } from '@converse/skeletor';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import ModelWithVCard from '../../shared/model-with-vcard';
import ColorAwareModel from '../../shared/color.js';
import { isIdle, getIdleSeconds } from './utils.js';

const { Stanza, Strophe, stx } = converse.env;

export default class Profile extends ModelWithVCard(ColorAwareModel(Model)) {
    defaults() {
        return {
            status: api.settings.get('default_state'),
            groups: [],
        };
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

    /**
     * @param {import('../roster/types.js').ContactDisplayNameOptions} [options]
     */
    getDisplayName(options) {
        const { __ } = _converse;
        const name = this.vcard?.get('fullname') || this.getNickname() || this.get('jid');
        return options?.context === 'roster' ? `${name} (${__('me')})` : name;
    }

    getNickname() {
        return this.vcard?.get('nickname') || api.settings.get('nickname');
    }

    /**
     * Constructs a presence stanza
     * @param {import('./types').presence_attrs} [attrs={}]
     */
    async constructPresence(attrs = {}) {
        debugger;
        const type =
            typeof attrs.type === 'string' ? attrs.type : this.get('status') || api.settings.get('default_state');
        const status = typeof attrs.status === 'string' ? attrs.status : this.get('status_message');
        const include_nick = status === 'subscribe';
        const { show, to } = attrs;

        const { profile } = _converse.state;
        const nick = include_nick ? profile.getNickname() : null;
        const priority = api.settings.get('priority');

        let idle_since;
        if (isIdle()) {
            idle_since = new Date();
            idle_since.setSeconds(idle_since.getSeconds() - getIdleSeconds());
        }

        const presence = stx`
            <presence ${to ? Stanza.unsafeXML(`to="${Strophe.xmlescape(to)}"`) : ''}
                    ${type ? Stanza.unsafeXML(`type="${Strophe.xmlescape(type)}"`) : ''}
                    xmlns="jabber:client">
                ${nick ? stx`<nick xmlns="${Strophe.NS.NICK}">${nick}</nick>` : ''}
                ${show ? stx`<show>${show}</show>` : ''}
                ${status ? stx`<status>${status}</status>` : ''}
                <priority>${Number.isNaN(Number(priority)) ? 0 : priority}</priority>
                ${idle_since ? stx`<idle xmlns="${Strophe.NS.IDLE}" since="${idle_since.toISOString()}"></idle>` : ''}
            </presence>`;

        /**
         * *Hook* which allows plugins to modify a presence stanza
         * @event _converse#constructedPresence
         */
        return await api.hook('constructedPresence', null, presence);
    }
}
