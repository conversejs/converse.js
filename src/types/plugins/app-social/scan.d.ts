/**
 * The compact "Find people to follow" control that lives in the compose toolbar.
 * It runs the explicit microblog discovery sweep
 * ({@link _converse.api.microblog.scanFollowable}) and shows inline progress with
 * a cancel affordance. It owns no suggestion state: results land in the followable
 * cache, which the suggestions card (`converse-social-onboarding`) renders
 * reactively. So the two are decoupled — connected only through the cache.
 */
export default class SocialScan extends CustomElement {
    scanning: boolean;
    scanned: number;
    scan_total: number;
    scan_found: number;
    /** @type {AbortController|null} */
    abort: AbortController | null;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * Run an explicit, throttled sweep that probes roster contacts' microblog
     * nodes (including offline ones). Verdicts land in the followable cache.
     */
    scan(): Promise<void>;
    /**
     * Cancel an in-progress sweep. Aborting stops new probes, but in-flight ones
     * can take until their timeout to settle — so we free the control immediately.
     * Those probes finish (and cache their results) in the background; their
     * now-orphaned callbacks are ignored via the ownership check in {@link scan}.
     */
    cancelScan(): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=scan.d.ts.map