/**
 * Warns, above the composer of a 1:1 chat, that the user is writing to someone
 * for whom it's the middle of the night.
 *
 * Held back until they actually start writing. Opening a chat to read it is no
 * reason to be warned about sending, and a warning that arrives then would be
 * dismissed out of the way long before there is anything to send.
 *
 * Which JID to query, when to query it, and what the answer means all live in
 * the headless `converse-time` plugin, so that a non-browser client can reuse
 * them. This element only paints the answer, keeps the displayed clock ticking,
 * and lets the user dismiss it.
 */
export default class EntityTimeAlert extends CustomElement {
    static properties: {
        model: {
            type: ObjectConstructor;
        };
    };
    model: any;
    answered: boolean;
    /** @type {ReturnType<typeof setTimeout>|null} */
    _sync_timeout: ReturnType<typeof setTimeout> | null;
    /** @type {ReturnType<typeof setInterval>|null} */
    _update_interval: ReturnType<typeof setInterval> | null;
    set dismissed(value: boolean);
    /**
     * Whether the user has dismissed the warning for the window it's in. It
     * lasts only as long as that window: see onTick, which forgets it once
     * their local time has left it.
     * @returns {boolean}
     */
    get dismissed(): boolean;
    /**
     * What we know about the contact's local time at this instant.
     * @returns {import('@converse/headless/types/plugins/time/types').ContactTime|null}
     */
    getContactTime(): import("@converse/headless/types/plugins/time/types").ContactTime | null;
    /**
     * Whether the user is writing to this contact right now.
     *
     * 'paused' counts as well as 'composing': it's where a chat lands ten
     * seconds after the last keystroke, and stopping to think about the wording
     * is not a reason for the warning to disappear.
     * @returns {boolean}
     */
    isComposing(): boolean;
    /**
     * Ticks the displayed time over on the minute, so that it tracks the clock
     * instead of freezing at whatever it read when the chat was opened, and so
     * that the warning appears and disappears as their local time crosses into
     * and out of the off-hours window.
     *
     * Only contacts whose offset differs from ours by enough to be warned about
     * get a clock. For everyone else no hour of the day can produce a warning,
     * so there is nothing for a timer to discover, and their offset changing is
     * an event we already listen for.
     */
    startClockUpdates(): void;
    stopClockUpdates(): void;
    /**
     * A dismissal silences the off-hours window it was made in, not every
     * window from here on. Once their local time has left the window, forget
     * it, so that tomorrow night warns again in a session left open overnight.
     */
    onTick(): void;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {MouseEvent} ev
     */
    dismiss(ev: MouseEvent): void;
    /**
     * @returns {string}
     */
    getDisplayName(): string;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=entity-time-alert.d.ts.map