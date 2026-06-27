/**
 * User-setting key recording that the user has completed or dismissed the
 * social onboarding card, so the first-run nudge doesn't reappear. User
 * settings are stored locally (per account, in the browser) and not (yet)
 * synced across devices.
 * A device where the user already follows someone (synced via XEP-0330 list)
 * won't show the card regardless of this flag.
 */
export const ONBOARDING_DISMISSED: "social_onboarding_dismissed";
/**
 * A non-blocking "who to follow" card shown at the top of the social feed while
 * the user follows nobody yet. It suggests roster contacts that advertise a
 * social feed ({@link _converse.api.microblog.discoverFollowable}) and lets the
 * user bulk-follow them. It hides itself once the user follows anyone, dismisses
 * it, or has no followable contacts to suggest.
 */
export default class SocialOnboarding extends CustomElement {
    /** @type {Array<{jid: string, name: string}>} */
    candidates: Array<{
        jid: string;
        name: string;
    }>;
    /** Checked JIDs (candidates are checked by default). @type {Set<string>} */
    selected: Set<string>;
    /** Candidates we've already defaulted-checked, so an explicit uncheck sticks. */
    seen: Set<any>;
    dismissed: boolean;
    busy: boolean;
    initialize(): Promise<void>;
    /** Recompute the followable candidates and default-check any newly found. */
    refresh(): Promise<void>;
    /** How many feeds the user follows (excludes their own feed). */
    get followed_count(): any;
    /** The card shows only as a first-run nudge: nobody followed, not dismissed, and something to suggest. */
    get visible(): boolean;
    render(): import("lit-html").TemplateResult<1> | "";
    /**
     * @param {string} jid
     */
    toggleSelect(jid: string): void;
    /** Follow every checked candidate, then remember the card is done. */
    followSelected(): Promise<void>;
    /** Dismiss the card without following anyone. */
    dismiss(): Promise<void>;
    /** Persist that onboarding is finished so it doesn't reappear (incl. other devices). */
    markDone(): Promise<void>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=onboarding.d.ts.map