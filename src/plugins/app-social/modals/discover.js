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

/**
 * The "Discover" modal: the single entry point for growing who you follow, so the
 * feed's compose area stays uncluttered. Houses two actions:
 *  - "Find people to follow": the {@link SocialScan} sweep over roster contacts
 *    (its results surface in the feed's suggestions card); and
 *  - "Follow a feed": follow a social feed that isn't a roster contact (a
 *    community or news node on a pubsub service) by address, probing it via
 *    {@link _converse.api.microblog.followByAddress} so an unreadable address
 *    fails loudly, and recording the durable XEP-0330 follow.
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
