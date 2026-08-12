export default class EntityTimeAlert extends CustomElement {
    static properties: {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    /** @type {import('@converse/headless/types/plugins/time/types').EntityTime|null} */
    time_info: import("@converse/headless/types/plugins/time/types").EntityTime | null;
    loading: boolean;
    dismissed: boolean;
    /** @type {ReturnType<typeof setTimeout>|null} */
    _fetch_timeout: ReturnType<typeof setTimeout> | null;
    /** @type {ReturnType<typeof setTimeout>|null} */
    _sync_timeout: ReturnType<typeof setTimeout> | null;
    /** @type {ReturnType<typeof setInterval>|null} */
    _update_interval: ReturnType<typeof setInterval> | null;
    initialize(): Promise<void>;
    model: any;
    _setupAndFetch(): Promise<void>;
    setupPresenceListeners(): void;
    /**
     * Get full JID (with resource) - needed because bare JID queries go to server.
     * @returns {string|null}
     */
    getFullJid(): string | null;
    /**
     * Fetch entity time with debouncing to prevent rapid re-queries on presence flapping.
     */
    fetchEntityTime(): void;
    /**
     * @private
     */
    private _doFetch;
    render(): import("lit-html").TemplateResult<1> | "";
    /**
     * @param {MouseEvent} ev
     */
    dismiss(ev: MouseEvent): void;
    /**
     * Gets the display name for the contact
     * @returns {string}
     */
    getDisplayName(): string;
    /**
     * Gets the formatted current time in the remote contact's timezone
     * @returns {string}
     */
    getFormattedTime(): string;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=entity-time-alert.d.ts.map