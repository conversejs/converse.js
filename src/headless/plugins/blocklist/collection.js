import { getOpenPromise } from '@converse/openpromise';
import { Collection } from '@converse/skeletor';
import log from "@converse/log";
import _converse from '../../shared/_converse.js';
import { initStorage } from '../../utils/storage.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import BlockedEntity from './model.js';

const { stx, u } = converse.env;

/**
 * @extends {Collection<BlockedEntity>}
 */
class Blocklist extends Collection {
    get idAttribute() {
        return 'jid';
    }

    constructor() {
        super();
        this.model = BlockedEntity;
    }

    async initialize() {
        const { session } = _converse;
        const cache_key = `converse.blocklist-${session.get('bare_jid')}`;
        this.fetched_flag = `${cache_key}-fetched`;
        initStorage(this, cache_key);

        this.on('add', this.rejectContactRequest);

        await this.fetchBlocklist();

        /**
         * Triggered once the {@link Blocklist} collection
         * has been created and cached blocklist have been fetched.
         * @event _converse#blocklistInitialized
         * @type {Blocklist}
         * @example _converse.api.listen.on('blocklistInitialized', (blocklist) => { ... });
         */
        api.trigger('blocklistInitialized', this);
    }

    /**
     * @param {BlockedEntity} item
     */
    async rejectContactRequest(item) {
        const roster = await api.waitUntil('rosterContactsFetched');
        const contact = roster.get(item.get('jid'));
        if (contact?.get('requesting')) {
            const chat = await api.chats.get(contact.get('jid'));
            chat?.close();
            contact.unauthorize().destroy();
        }
    }

    fetchBlocklist() {
        const deferred = getOpenPromise();
        if (_converse.state.session.get(this.fetched_flag)) {
            this.fetch({
                success: () => deferred.resolve(),
                error: () => deferred.resolve(),
            });
        } else {
            this.fetchBlocklistFromServer(deferred);
        }
        return deferred;
    }

    /**
     * @param {Object} deferred
     */
    async fetchBlocklistFromServer(deferred) {
        const stanza = stx`<iq xmlns="jabber:client"
            type="get"
            id="${u.getUniqueId()}"><blocklist xmlns="urn:xmpp:blocking"/></iq>`;

        try {
            this.onBlocklistReceived(deferred, await api.sendIQ(stanza));
        } catch (e) {
            log.error(e);
            deferred.resolve();
            return;
        }
    }

    /**
     * @param {Object} deferred
     * @param {Element} iq
     */
    async onBlocklistReceived(deferred, iq) {
        Array.from(iq.querySelectorAll('blocklist item')).forEach((item) => {
            const jid = item.getAttribute('jid');
            const blocked = this.get(jid);
            blocked ? blocked.save({ jid }) : this.create({ jid });
        });

        _converse.state.session.set(this.fetched_flag, true);
        if (deferred !== undefined) {
            return deferred.resolve();
        }
    }
}

export default Blocklist;
