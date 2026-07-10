declare const SocialFollowing_base: typeof CustomElement & (new (...args: any[]) => import("@lit-labs/signals").SignalWatcherApi);
/**
 * The following list (embedded in a profile's "Following" tab): the accounts an
 * account follows, read from the durable XEP-0330 follow list
 * (`urn:xmpp:pubsub:subscription`). Renders just the list body; the surrounding
 * profile provides the header (whose list it is) and the tab chrome.
 *
 * For our own list we track `_converse.state.following` via a `collectionSignal`,
 * so the list re-renders as follows are added or removed (including an unfollow
 * from within this view) and each row keeps an Unfollow button.
 *
 * For another account we read their (presence-access) node once: rows are
 * read-only, and the fetch may be refused (a stranger, or no node), which we show
 * as a graceful "not available" state rather than an error.
 */
export default class SocialFollowing extends SocialFollowing_base {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
        _loaded: {
            type: BooleanConstructor;
            state: boolean;
        };
        _error: {
            type: StringConstructor;
            state: boolean;
        };
    };
    jid: any;
    _loaded: boolean;
    _error: any;
    following: import("@lit-labs/signals").Signal.State<import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>[]>;
    _entries: any[];
    /**
     * Whether this is our own follow list (live + editable) vs another account's.
     * @returns {boolean}
     */
    get isOwn(): boolean;
    /**
     * The account whose list this is (for the header caption / avatars).
     * @returns {import('@converse/headless').MicroblogProfile}
     */
    get owner(): import("@converse/headless").MicroblogProfile;
    /** Read another account's follow list once (best-effort). */
    fetchFollowing(): Promise<void>;
    /**
     * The followed entries, each a `{ jid, node, title, profile, label }`: a
     * follow is a (server=jid, node) pair, so the node distinguishes multiple
     * feeds on one service, and `label` (the follow's title, else the profile's
     * display name) is what we show and sort by. For our own list, reading the
     * signal here keeps it auto-tracked by `SignalWatcher`.
     * @returns {Array<{ jid: string, node: string, title: string, profile: import('@converse/headless').MicroblogProfile, label: string }>}
     */
    get entries(): {
        jid: string;
        node: string;
        title: string;
        profile: import("@converse/headless").MicroblogProfile;
        label: string;
    }[];
    render(): import("lit-html").TemplateResult<1>;
    /**
     * Open a followed feed: a person's microblog opens their profile; a community
     * node opens that node's feed (both handled by the profile view, node-aware).
     * @param {string} jid
     * @param {string} node
     */
    onSelect(jid: string, node: string): void;
    /**
     * Unfollow a feed (retract the XEP-0330 item + unsubscribe). Only offered on
     * our own list; the row drops reactively once the mirror loses the entry.
     * @param {Event} ev
     * @param {string} jid
     * @param {string} node
     */
    onUnfollow(ev: Event, jid: string, node: string): Promise<void>;
}
import { CustomElement } from 'shared/components/element.js';
export {};
//# sourceMappingURL=following.d.ts.map