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
    constructor();
    /** @type {string} */
    address: string;
    /** @type {{ jid: string, node: string }|null} */
    preview: {
        jid: string;
        node: string;
    } | null;
    submitting: boolean;
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