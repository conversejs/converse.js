/**
 * The recurring "Accounts you might like to follow" card shown above the feed
 * when there are suggestions. It reacts to the followable cache (populated by the
 * `converse-social-scan` control in the compose toolbar) plus online-caps hits,
 * and lets the user bulk-follow or snooze them. It owns no scanning state — when
 * there's nothing to suggest it renders nothing.
 */
export default class SocialOnboarding extends CustomElement {
    /** The bare JIDs of followable contacts. @type {string[]} */
    candidates: string[];
    /** Checked JIDs (candidates are checked by default). @type {Set<string>} */
    selected: Set<string>;
    /** Candidates we've already defaulted-checked, so an explicit uncheck sticks. */
    seen: Set<any>;
    busy: boolean;
    debouncedRefresh: import("lodash").DebouncedFunc<() => Promise<void>>;
    initialize(): Promise<void>;
    /** Recompute the followable candidates and default-check any newly found. */
    refresh(): Promise<void>;
    render(): import("lit-html").TemplateResult<1> | "";
    /**
     * @param {MouseEvent} ev
     * @param {import('@converse/headless/types/plugins/roster/contact').default} contact
     */
    showUserModal(ev: MouseEvent, contact: import("@converse/headless/types/plugins/roster/contact").default): void;
    /**
     * @param {string} jid
     */
    toggleSelect(jid: string): void;
    /** Follow every checked candidate. The card stays for any remaining/new ones. */
    followSelected(): Promise<void>;
    /**
     * Snooze the current suggestions (via the followable cache). They won't be
     * suggested again until a *new* followable contact is discovered.
     */
    dismiss(): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=onboarding.d.ts.map