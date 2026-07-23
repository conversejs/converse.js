/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { _converse, api, log } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import debounce from 'lodash-es/debounce.js';
import tplOnboarding from './templates/onboarding.js';

/**
 * The recurring "Accounts you might like to follow" card shown above the feed
 * when there are suggestions. It reacts to the followable cache (populated by the
 * `converse-social-scan` control in the compose toolbar) plus online-caps hits,
 * and lets the user bulk-follow or snooze them. It owns no scanning state — when
 * there's nothing to suggest it renders nothing.
 */
export default class SocialOnboarding extends CustomElement {
    constructor() {
        super();
        /** The bare JIDs of followable contacts. @type {string[]} */
        this.candidates = [];
        /** Checked JIDs (candidates are checked by default). @type {Set<string>} */
        this.selected = new Set();
        /** Candidates we've already defaulted-checked, so an explicit uncheck sticks. */
        this.seen = new Set();
        this.busy = false;
        // Roster/presence/cache changes arrive in bursts; coalesce into one rescan.
        this.debouncedRefresh = debounce(() => this.refresh(), 250);
    }

    async initialize() {
        await api.waitUntil('pubsubFeedsInitialized');
        const { roster, presences, pubsubfeeds, followablecache } = _converse.state;

        // A follow (here or on another device) materialises a feed → recompute.
        this.listenTo(pubsubfeeds, 'add', () => this.debouncedRefresh());
        this.listenTo(pubsubfeeds, 'remove', () => this.debouncedRefresh());

        // Sweep verdicts land in the cache → surface (or retract) suggestions live.
        if (followablecache) {
            this.listenTo(followablecache, 'add', () => this.debouncedRefresh());
            this.listenTo(followablecache, 'change', () => this.debouncedRefresh());
        }

        // Roster / presence / resource changes can reveal a contact's online
        // social-feed caps (the cheap path). Caps are advertised per-resource, so
        // watch each contact's resources too: a feed-bearing resource coming
        // online on an already-online contact doesn't change aggregate presence.
        if (roster) {
            this.listenTo(roster, 'add', () => this.debouncedRefresh());
            this.listenTo(roster, 'change', () => this.debouncedRefresh());
        }
        if (presences) {
            const watchResources = /** @param {import('@converse/headless').Presence} p */ (p) =>
                this.listenTo(p.resources, 'add change remove', () => this.debouncedRefresh());
            presences.forEach(watchResources);
            this.listenTo(
                presences,
                'add',
                /** @param {import('@converse/headless').Presence} p */ (p) => {
                    watchResources(p);
                    this.debouncedRefresh();
                },
            );
            this.listenTo(presences, 'change', () => this.debouncedRefresh());
        }

        await this.refresh();
    }

    /** Recompute the followable candidates and default-check any newly found. */
    async refresh() {
        let candidates = [];
        try {
            candidates = await api.microblog.discoverFollowable();
        } catch (e) {
            log.error(e);
        }
        candidates.forEach(
            /** @param {string} jid */ (jid) => {
                if (!this.seen.has(jid)) {
                    this.selected.add(jid);
                    this.seen.add(jid);
                }
            },
        );
        // Drop selections that are no longer candidates (e.g. just followed/snoozed).
        [...this.selected].forEach((jid) => {
            if (!candidates.includes(jid)) this.selected.delete(jid);
        });
        this.candidates = candidates;
        this.requestUpdate();
    }

    render() {
        if (!this.candidates.length) return '';
        return tplOnboarding(this);
    }

    /**
     * @param {MouseEvent} ev
     * @param {import('@converse/headless/types/plugins/roster/contact').default} contact
     */
    showUserModal(ev, contact) {
        ev.preventDefault();
        api.modal.show('converse-user-details-modal', { model: contact }, ev);
    }

    /**
     * @param {string} jid
     */
    toggleSelect(jid) {
        if (this.selected.has(jid)) this.selected.delete(jid);
        else this.selected.add(jid);
        this.requestUpdate();
    }

    /** Follow every checked candidate. The card stays for any remaining/new ones. */
    async followSelected() {
        const jids = this.candidates.filter((jid) => this.selected.has(jid));
        if (!jids.length) return;
        this.busy = true;
        this.requestUpdate();
        try {
            await api.microblog.followMany(jids);
            await this.refresh();
        } finally {
            this.busy = false;
            this.requestUpdate();
        }
    }

    /**
     * Snooze the current suggestions (via the followable cache). They won't be
     * suggested again until a *new* followable contact is discovered.
     */
    dismiss() {
        _converse.state.followablecache?.snooze(this.candidates);
        this.refresh();
    }
}

api.elements.define('converse-social-onboarding', SocialOnboarding);
