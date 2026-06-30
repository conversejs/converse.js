/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, log } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplScan from './templates/scan.js';

/**
 * The compact "Find people to follow" control that lives in the compose toolbar.
 * It runs the explicit microblog discovery sweep
 * ({@link _converse.api.microblog.scanFollowable}) and shows inline progress with
 * a cancel affordance. It owns no suggestion state: results land in the followable
 * cache, which the suggestions card (`converse-social-onboarding`) renders
 * reactively. So the two are decoupled — connected only through the cache.
 */
export default class SocialScan extends CustomElement {
    constructor() {
        super();
        this.scanning = false;
        this.scanned = 0;
        this.scan_total = 0;
        this.scan_found = 0;
        /** @type {AbortController|null} */
        this.abort = null;
    }

    render() {
        return tplScan(this);
    }

    /**
     * Run an explicit, throttled sweep that probes roster contacts' microblog
     * nodes (including offline ones). Verdicts land in the followable cache.
     */
    async scan() {
        if (this.scanning) return;
        // The controller doubles as an ownership token: once it's no longer
        // `this.abort` (cancelled or superseded), this sweep's callbacks stop
        // driving the control.
        const controller = new AbortController();
        this.abort = controller;
        this.scanning = true;
        this.scanned = 0;
        this.scan_total = 0;
        this.scan_found = 0;
        this.requestUpdate();
        try {
            await api.microblog.scanFollowable({
                signal: controller.signal,
                onProgress: ({ scanned, total, found }) => {
                    if (this.abort !== controller) return;
                    this.scanned = scanned;
                    this.scan_total = total;
                    this.scan_found = found;
                    this.requestUpdate();
                },
            });
        } catch (e) {
            log.error(e);
        } finally {
            if (this.abort === controller) {
                this.scanning = false;
                this.abort = null;
                this.requestUpdate();
            }
        }
    }

    /**
     * Cancel an in-progress sweep. Aborting stops new probes, but in-flight ones
     * can take until their timeout to settle — so we free the control immediately.
     * Those probes finish (and cache their results) in the background; their
     * now-orphaned callbacks are ignored via the ownership check in {@link scan}.
     */
    cancelScan() {
        this.abort?.abort();
        this.abort = null;
        this.scanning = false;
        this.requestUpdate();
    }
}

api.elements.define('converse-social-scan', SocialScan);
