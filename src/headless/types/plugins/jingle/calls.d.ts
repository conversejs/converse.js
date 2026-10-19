export default Calls;
/**
 * A memory-only, ephemeral collection of live {@link Call}s - one per session.
 * @extends {Collection<Call>}
 */
declare class Calls extends Collection<Call> {
    constructor();
    get model(): typeof Call;
    /** @type {Map<string, number>} when each session id we know of was last in use */
    seen_sids: Map<string, number>;
    /** @param {string} sid */
    see(sid: string): void;
    /**
     * Whether `sid` belongs to a session we already know of. Session ids are
     * globally unique (XEP-0353 § 3.1), so a `<propose>` that repeats one is a
     * copy of an old one, e.g. resent after a lost connection.
     * @param {string} sid
     * @returns {boolean}
     */
    hasSeen(sid: string): boolean;
}
import Call from './model.js';
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=calls.d.ts.map