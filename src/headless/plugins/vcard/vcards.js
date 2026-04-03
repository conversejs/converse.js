import { Collection } from '@converse/skeletor';
import { getOpenPromise } from '@converse/openpromise';
import api from '../../shared/api/index.js';
import _converse from '../../shared/_converse.js';
import { initStorage } from '../../utils/storage.js';
import VCard from './vcard';
import log from '@converse/log';

/**
 * @extends {Collection<VCard>}
 */
class VCards extends Collection {
    constructor() {
        super();
        this.model = VCard;
    }

    async initialize() {
        const { session } = _converse;
        const bare_jid = session.get('bare_jid');
        const cache_key = `${bare_jid}-converse.vcards`;
        initStorage(this, cache_key);

        await this.fetchVCards();

        /**
         * Triggered as soon as the `_converse.state.vcards` collection has
         * been initialized and populated from cache.
         * @event _converse#VCardsInitialized
         */
        api.trigger('VCardsInitialized');
    }

    fetchVCards() {
        const deferred = getOpenPromise();
        this.fetch({
            success: () => deferred.resolve(),
            error: () => deferred.resolve(),
        });
        return deferred;
    }

    /**
     * Removes VCards from the cache that don't belong to any active entity:
     * roster contacts, MUC occupants, or open chats.
     * @returns {Promise<number>} Number of VCards removed
     */
    async pruneVCards() {
        const validJids = new Set();

        // Always keep the user's own VCard
        const bare_jid = _converse.session.get('bare_jid');
        if (bare_jid) validJids.add(bare_jid);

        // Keep VCards for roster contacts
        const roster = _converse.state.roster;
        if (roster) {
            roster.pluck('jid').forEach((jid) => validJids.add(jid));
        }

        // Keep VCards for open chats (private chats and MUCs)
        const chatboxes = _converse.state.chatboxes;
        if (chatboxes) {
            chatboxes.filter((c) => c.get('jid') && !c.get('closed')).forEach((c) => validJids.add(c.get('jid')));

            // Keep VCards for MUC occupants
            chatboxes
                .filter((c) => c.get('type') === 'chatroom')
                .forEach((muc) => {
                    if (muc.occupants) {
                        muc.occupants.forEach((o) => {
                            const jid = o.get('jid');
                            if (jid) validJids.add(jid);
                        });
                    }
                });
        }

        const toRemove = this.filter((vcard) => !validJids.has(vcard.get('jid')));
        if (toRemove.length === 0) return 0;

        await Promise.all(
            toRemove.map((vcard) => {
                return new Promise((resolve) => {
                    vcard.destroy({ success: resolve, error: resolve });
                });
            }),
        );

        log.debug(`vcard: Pruned ${toRemove.length} stale VCard(s) from cache`);
        return toRemove.length;
    }
}

export default VCards;
