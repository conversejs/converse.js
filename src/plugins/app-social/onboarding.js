/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { _converse, api, log } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import debounce from 'lodash-es/debounce.js';
import tplOnboarding from './templates/onboarding.js';

/**
 * User-setting key recording that the user has completed or dismissed the
 * social onboarding card, so the first-run nudge doesn't reappear. User
 * settings are stored locally (per account, in the browser) and not (yet)
 * synced across devices.
 * A device where the user already follows someone (synced via XEP-0330 list)
 * won't show the card regardless of this flag.
 */
export const ONBOARDING_DISMISSED = 'social_onboarding_dismissed';

/**
 * A non-blocking "who to follow" card shown at the top of the social feed while
 * the user follows nobody yet. It suggests roster contacts that advertise a
 * social feed ({@link _converse.api.microblog.discoverFollowable}) and lets the
 * user bulk-follow them. It hides itself once the user follows anyone, dismisses
 * it, or has no followable contacts to suggest.
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
        this.dismissed = false;
        this.busy = false;
        // Roster/presence/resource changes arrive in bursts (notably the login
        // presence storm); coalesce them into a single rescan.
        this.debouncedRefresh = debounce(() => this.refresh(), 250);
    }

    async initialize() {
        const settings = await api.user.settings.getModel();
        this.dismissed = !!settings.get(ONBOARDING_DISMISSED);
        this.listenTo(settings, `change:${ONBOARDING_DISMISSED}`, () => {
            this.dismissed = !!settings.get(ONBOARDING_DISMISSED);
            this.requestUpdate();
        });

        await api.waitUntil('pubsubFeedsInitialized');
        // A follow (here or on another device) materialises a feed → recompute
        // visibility + candidates so the card hides once the user follows anyone.
        this.listenTo(_converse.state.pubsubfeeds, 'add', () => this.debouncedRefresh());
        this.listenTo(_converse.state.pubsubfeeds, 'remove', () => this.debouncedRefresh());

        // Roster / presence / resource changes can reveal (or retract) a
        // contact's social-feed caps. Caps are advertised per-resource, so we
        // watch each contact's resources too: a feed-bearing resource coming
        // online on an already-online contact (or a caps change) doesn't alter
        // the contact's aggregate presence, so it never surfaces as a
        // `presences` change.
        const { roster, presences } = _converse.state;
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
        // Drop selections that are no longer candidates (e.g. just followed).
        [...this.selected].forEach((jid) => {
            if (!candidates.includes(jid)) this.selected.delete(jid);
        });
        this.candidates = candidates;
        this.requestUpdate();
    }

    /**
     * @param {MouseEvent} ev
     * @param {import('@converse/headless/types/plugins/roster/contact').default} contact
     */
    showUserModal(ev, contact) {
        ev.preventDefault();
        api.modal.show('converse-user-details-modal', { model: contact }, ev);
    }

    /** How many feeds the user follows (excludes their own feed). */
    get followed_count() {
        const feeds = _converse.state.pubsubfeeds;
        return feeds ? feeds.filter((f) => !f.isOwnFeed()).length : 0;
    }

    /** The card shows only as a first-run nudge: nobody followed, not dismissed, and something to suggest. */
    get visible() {
        return !this.dismissed && this.followed_count === 0 && this.candidates.length > 0;
    }

    render() {
        if (!this.visible) return '';
        return tplOnboarding(this);
    }

    /**
     * @param {string} jid
     */
    toggleSelect(jid) {
        if (this.selected.has(jid)) this.selected.delete(jid);
        else this.selected.add(jid);
        this.requestUpdate();
    }

    /** Follow every checked candidate, then remember the card is done. */
    async followSelected() {
        const jids = this.candidates.filter((jid) => this.selected.has(jid));
        if (!jids.length) return;
        this.busy = true;
        this.requestUpdate();
        try {
            await api.microblog.followMany(jids);
            await this.markDone();
        } finally {
            this.busy = false;
            this.requestUpdate();
        }
    }

    /** Dismiss the card without following anyone. */
    async dismiss() {
        this.dismissed = true;
        this.requestUpdate();
        await this.markDone();
    }

    /** Persist that onboarding is finished so it doesn't reappear (incl. other devices). */
    async markDone() {
        try {
            await api.user.settings.set(ONBOARDING_DISMISSED, true);
        } catch (e) {
            log.error(e);
        }
    }
}

api.elements.define('converse-social-onboarding', SocialOnboarding);
