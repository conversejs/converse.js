/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { _converse, api, converse, log } from '@converse/headless';
import { SignalWatcher } from '@lit-labs/signals';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import { collectionSignal } from 'shared/signals.js';
import tplFollowing from './templates/following.js';
import { MICROBLOG_NODE } from './constants.js';

const { Strophe } = converse.env;

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
export default class SocialFollowing extends SignalWatcher(CustomElement) {
    static get properties() {
        return {
            // Whose follow list to show; defaults to our own bare JID.
            jid: { type: String },
            // For another account: whether the one-shot fetch has settled.
            _loaded: { type: Boolean, state: true },
            // For another account: the reason the fetch failed (e.g. 'forbidden'),
            // or null when it succeeded.
            _error: { type: String, state: true },
        };
    }

    constructor() {
        super();
        this.jid = null;
        this._loaded = false;
        this._error = null;
        // Our own list is a live signal; another account's is a fetched snapshot.
        this.following = null;
        this._entries = [];
    }

    initialize() {
        if (!this.jid) this.jid = _converse.session.get('bare_jid');
        if (this.isOwn) {
            this.following = collectionSignal(_converse.state.following);
            this._loaded = true;
        } else {
            this.fetchFollowing();
        }
    }

    /**
     * Whether this is our own follow list (live + editable) vs another account's.
     * @returns {boolean}
     */
    get isOwn() {
        return Strophe.getBareJidFromJid(this.jid) === _converse.session.get('bare_jid');
    }

    /**
     * The account whose list this is (for the header caption / avatars).
     * @returns {import('@converse/headless').MicroblogProfile}
     */
    get owner() {
        return api.microblog.profile.get(this.jid);
    }

    /** Read another account's follow list once (best-effort). */
    async fetchFollowing() {
        this._loaded = false;
        try {
            this._entries = await api.microblog.following(this.jid);
            this._error = null;
        } catch (e) {
            this._error = e?.name || 'error';
            this._entries = [];
        } finally {
            this._loaded = true;
            this.requestUpdate();
        }
    }

    /**
     * The followed entries, each a `{ jid, node, title, profile, label }`: a
     * follow is a (server=jid, node) pair, so the node distinguishes multiple
     * feeds on one service, and `label` (the follow's title, else the profile's
     * display name) is what we show and sort by. For our own list, reading the
     * signal here keeps it auto-tracked by `SignalWatcher`.
     * @returns {Array<{ jid: string, node: string, title: string, profile: import('@converse/headless').MicroblogProfile, label: string }>}
     */
    get entries() {
        const follows = this.isOwn
            ? /** @type {import('@converse/headless').Model[]} */ (this.following?.get() ?? []).map((m) => ({
                  server: m.get('server'),
                  node: m.get('node'),
                  title: m.get('title'),
              }))
            : this._entries;
        return follows
            .map((f) => {
                const profile = api.microblog.profile.get(f.server);
                // Prefer the follow's own title; for a community feed (a
                // non-microblog node) the node name is the human label; otherwise
                // it's a person's microblog, so use their display name.
                const isFeed = f.node && f.node !== MICROBLOG_NODE;
                return {
                    jid: f.server,
                    node: f.node,
                    title: f.title,
                    profile,
                    label: f.title || (isFeed ? f.node : profile.getDisplayName()),
                };
            })
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    render() {
        return tplFollowing(this);
    }

    /**
     * Open a followed feed: a person's microblog opens their profile; a community
     * node opens that node's feed (both handled by the profile view, node-aware).
     * @param {string} jid
     * @param {string} node
     */
    onSelect(jid, node) {
        this.dispatchEvent(
            new CustomEvent('profileselected', { detail: { jid, node }, bubbles: true, composed: true }),
        );
    }

    /**
     * Unfollow a feed (retract the XEP-0330 item + unsubscribe). Only offered on
     * our own list; the row drops reactively once the mirror loses the entry.
     * @param {Event} ev
     * @param {string} jid
     * @param {string} node
     */
    async onUnfollow(ev, jid, node) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        try {
            await api.microblog.unfollow(jid, { node });
        } catch (e) {
            log.error(e);
            api.toast.show('unfollow-failed', { type: 'danger', body: __('Sorry, could not unfollow') });
        }
    }
}

api.elements.define('converse-social-following', SocialFollowing);
