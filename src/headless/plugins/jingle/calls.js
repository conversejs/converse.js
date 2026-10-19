import { Collection } from '@converse/skeletor';
import Call from './model.js';

// How long a session id is remembered once it's no longer in use.
const SEEN_SID_TTL = 10 * 60_000;

/**
 * A memory-only, ephemeral collection of live {@link Call}s - one per session.
 * @extends {Collection<Call>}
 */
class Calls extends Collection {
    get model() {
        return Call;
    }

    constructor() {
        super();
        /** @type {Map<string, number>} when each session id we know of was last in use */
        this.seen_sids = new Map();
        this.on('add', (call) => this.see(call.sid));
        this.on('remove', (call) => this.see(call.sid));
        // A call moved to a new session leaves its old one behind.
        this.on('change:id', (call) => this.see(call.previous('id')));
    }

    /** @param {string} sid */
    see(sid) {
        this.seen_sids.set(sid, Date.now());
    }

    /**
     * Whether `sid` belongs to a session we already know of. Session ids are
     * globally unique (XEP-0353 § 3.1), so a `<propose>` that repeats one is a
     * copy of an old one, e.g. resent after a lost connection.
     * @param {string} sid
     * @returns {boolean}
     */
    hasSeen(sid) {
        const now = Date.now();
        this.seen_sids.forEach((time, s) => {
            if (now - time > SEEN_SID_TTL && !this.get(s)) this.seen_sids.delete(s);
        });
        return this.seen_sids.has(sid);
    }
}

export default Calls;
