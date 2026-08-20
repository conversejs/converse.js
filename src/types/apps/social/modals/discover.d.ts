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
    constructor();
    /** @type {string} */
    address: string;
    /** @type {{ jid: string, node: string }|null} */
    preview: {
        jid: string;
        node: string;
    } | null;
    submitting: boolean;
    /**
     * Open a browsed feed in the Social app's read-only feed view and close this
     * modal. The app listens for `openSocialFeed` (see {@link SocialApp}).
     * @param {CustomEvent} ev
     */
    onFeedSelected(ev: CustomEvent): void;
    renderModal(): import("lit-html").TemplateResult<1>;
    getModalTitle(): any;
    /**
     * Re-parse the address on each keystroke so the preview line and the enabled
     * state of the submit button track what the user has typed.
     * @param {Event} ev
     */
    onAddressInput(ev: Event): void;
    /**
     * @param {Event} ev
     */
    submit(ev: Event): Promise<void>;
}
import BaseModal from 'plugins/modal/modal.js';
//# sourceMappingURL=discover.d.ts.map