/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, log } from '@converse/headless';
import BaseModal from 'plugins/modal/modal.js';
import { __ } from 'i18n';
import tplDiscover from './templates/discover.js';
import '../scan.js';
import '../onboarding.js';
import '../browse.js';

/**
 * The "Discover" modal: the single entry point for growing who you follow, so the
 * feed's compose area stays uncluttered. Houses three actions:
 *  - "Find people to follow": the {@link SocialScan} sweep over roster contacts
 *    (its results surface in the feed's suggestions card);
 *  - "Follow a feed": browse the feed nodes hosted on a pubsub service
 *    ({@link SocialBrowse} → {@link _converse.api.microblog.browseFeeds}) and pick
 *    one, or, for a known address, follow it directly by address, probing it via
 *    {@link _converse.api.microblog.followByAddress} so an unreadable address
 *    fails loudly. Either way the durable XEP-0330 follow is recorded.
 */
export default class SocialDiscoverModal extends BaseModal {
    constructor() {
        super();
        /** @type {string} */
        this.address = '';
        /** @type {{ jid: string, node: string }|null} */
        this.preview = null;
        this.submitting = false;
    }

    initialize() {
        super.initialize();
        this.addEventListener(
            'shown.bs.modal',
            () => /** @type {HTMLInputElement} */ (this.querySelector('input[name="address"]'))?.focus(),
            false,
        );
        // A feed picked in the browse list. This modal renders in the modal
        // portal (outside the Social app), so we bridge the intent over the event
        // bus rather than by DOM bubbling, then close the modal.
        this.addEventListener('feedselected', (ev) => this.onFeedSelected(/** @type {CustomEvent} */ (ev)));
    }

    /**
     * Open a browsed feed in the Social app's read-only feed view and close this
     * modal. The app listens for `openSocialFeed` (see {@link SocialApp}).
     * @param {CustomEvent} ev
     */
    onFeedSelected(ev) {
        const { jid, node } = ev.detail ?? {};
        if (!jid || !node) return;
        api.trigger('openSocialFeed', { jid, node });
        this.modal.hide();
    }

    renderModal() {
        return tplDiscover(this);
    }

    getModalTitle() {
        return __('Discover');
    }

    /**
     * Re-parse the address on each keystroke so the preview line and the enabled
     * state of the submit button track what the user has typed.
     * @param {Event} ev
     */
    onAddressInput(ev) {
        this.address = /** @type {HTMLInputElement} */ (ev.target).value;
        this.preview = api.microblog.parseFeedAddress(this.address);
        this.requestUpdate();
    }

    /**
     * @param {Event} ev
     */
    async submit(ev) {
        ev.preventDefault();
        if (this.submitting) return;

        const data = new FormData(/** @type {HTMLFormElement} */ (ev.target));
        const address = /** @type {string} */ (data.get('address') || '').trim();
        const title = /** @type {string} */ (data.get('title') || '').trim() || undefined;
        const node = /** @type {string} */ (data.get('node') || '').trim() || undefined;

        if (!api.microblog.parseFeedAddress(address)) {
            this.alert(__('Please enter a valid feed address'), 'danger', false);
            return;
        }

        this.submitting = true;
        this.alert(null);
        this.requestUpdate();
        try {
            await api.microblog.followByAddress(address, { node, title });
            api.toast.show('feed-followed', { type: 'success', body: __('Now following this feed') });
            this.modal.hide();
        } catch (e) {
            log.error(e);
            const msg =
                e?.name === 'FeedNotFound'
                    ? __('No feed found at that address')
                    : e?.name === 'InvalidFeedAddress'
                      ? __('Please enter a valid feed address')
                      : __('Sorry, following this feed failed');
            this.alert(msg, 'danger', false);
        } finally {
            this.submitting = false;
            this.requestUpdate();
        }
    }
}

api.elements.define('converse-social-discover-modal', SocialDiscoverModal);
