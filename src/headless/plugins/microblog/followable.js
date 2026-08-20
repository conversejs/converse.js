/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Collection, Model } from '@converse/skeletor';
import _converse from '../../shared/_converse.js';
import { createStore } from '../../utils/storage.js';

/**
 * One cached verdict on whether a contact has a followable microblog feed,
 * learned by probing their `urn:xmpp:microblog:0` node during a manual "find
 * people to follow" sweep.
 * @extends {Model}
 */
export class FollowableContact extends Model {
    get idAttribute() {
        return 'jid';
    }

    defaults() {
        return {
            /** Whether the contact has a readable microblog feed with content. */
            followable: false,
            /** Whether the user dismissed this suggestion (snooze-until-new). */
            snoozed: false,
            /** ISO time of the newest post seen, for preview/sort (optional). */
            latest: null,
        };
    }
}

/**
 * The per-account, persisted cache of microblog-followability verdicts, keyed by
 * bare JID. Registered as `_converse.state.followablecache`. It lets a manual
 * sweep avoid re-probing contacts it already checked, and backs the recurring
 * "Accounts you might like to follow" widget (including its snooze state).
 *
 * Mirrors the {@link import('./feeds.js').default} persistence pattern.
 * @extends {Collection<FollowableContact>}
 */
class FollowableCache extends Collection {
    get model() {
        return FollowableContact;
    }

    get autoSync() {
        return true;
    }

    initialize() {
        const bare_jid = _converse.session.get('bare_jid');
        this.storage = createStore(`converse.microblog-followable-${bare_jid}`);
    }

    /**
     * Whether this JID has been snoozed by the user.
     * @param {string} jid
     * @returns {boolean}
     */
    isSnoozed(jid) {
        return !!this.get(jid)?.get('snoozed');
    }

    /**
     * Upsert a probe verdict.
     * @param {string} jid
     * @param {{ followable: boolean, latest?: string|null }} verdict
     */
    record(jid, { followable, latest = null }) {
        const attrs = { followable, latest };
        const entry = this.get(jid);
        if (entry) entry.save(attrs);
        else this.create({ jid, ...attrs });
    }

    /**
     * The bare JIDs known followable and not snoozed.
     * @returns {string[]}
     */
    candidates() {
        return this.filter((c) => c.get('followable') && !c.get('snoozed')).map((c) => c.get('jid'));
    }

    /**
     * Snooze the given JIDs so they stop being suggested until a *new* candidate
     * is discovered. Creates a cache entry for JIDs not probed yet (e.g. an
     * online-caps hit), so the snooze sticks.
     * @param {string[]} jids
     */
    snooze(jids) {
        jids.forEach((jid) => {
            const entry = this.get(jid);
            if (entry) entry.save({ snoozed: true });
            else this.create({ jid, snoozed: true });
        });
    }
}

export default FollowableCache;
