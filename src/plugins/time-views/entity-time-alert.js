import { api, constants } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplEntityTimeAlert from './templates/entity-time-alert.js';

const { COMPOSING, PAUSED } = constants;

// Whether the warning has been dismissed, per chat. Kept beside the chat rather
// than on it, because a chat is a persisted model and this is true only of
// tonight; and beside the element rather than in it, so that it survives the
// element being re-rendered or moved.
/** @type {WeakMap<any, boolean>} */
const dismissed_by_chat = new WeakMap();

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
    static properties = {
        model: { type: Object },
    };

    constructor() {
        super();
        this.model = null;
        this.answered = false;
        /** @type {ReturnType<typeof setTimeout>|null} */
        this._sync_timeout = null;
        /** @type {ReturnType<typeof setInterval>|null} */
        this._update_interval = null;
    }

    connectedCallback() {
        super.connectedCallback();
        // Re-arm after the element was moved in the DOM, which tears the timers down.
        this.startClockUpdates();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.stopClockUpdates();
    }

    initialize() {
        super.initialize();
        if (!this.model) return;

        // The offset is the contact's, and the contact arrives after the chat.
        this.model.rosterContactAdded?.then(() => {
            this.listenTo(this.model.contact, 'entity_time:change', () => {
                // Their offset decides whether a clock is worth running at all,
                // so a new one is a reason to reconsider, not just to re-arm.
                this.stopClockUpdates();
                this.startClockUpdates();
                this.requestUpdate();
            });
            // connectedCallback ran before the contact was here to be asked
            // about, so this is the first moment a clock can be started for an
            // offset we already knew.
            this.startClockUpdates();
            this.requestUpdate();
        });

        this.listenTo(this.model, 'change:chat_state', () => {
            // A fresh message is a fresh question.
            if (this.model.get('chat_state') === COMPOSING) this.answered = false;
            this.requestUpdate();
        });

        // Sending is the user answering the warning. It's tracked here rather
        // than read off the chat state, which the composer puts back to
        // 'active' silently (to keep a redundant chat state notification off
        // the wire) and only after this element has already repainted.
        if (this.model.messages) {
            this.listenTo(this.model.messages, 'add', (/** @type {any} */ msg) => {
                if (msg.get('sender') !== 'me') return;
                this.answered = true;
                this.requestUpdate();
            });
        }
    }

    /**
     * Whether the user has dismissed the warning for the window it's in. It
     * lasts only as long as that window: see onTick, which forgets it once
     * their local time has left it.
     * @returns {boolean}
     */
    get dismissed() {
        return this.model ? (dismissed_by_chat.get(this.model) ?? false) : false;
    }

    set dismissed(value) {
        if (this.model) dismissed_by_chat.set(this.model, value);
    }

    /**
     * What we know about the contact's local time at this instant.
     * @returns {import('@converse/headless/types/plugins/time/types').ContactTime|null}
     */
    getContactTime() {
        // Optional, because `strict_plugin_dependencies` is off by default and
        // so the headless plugin this one declares a dependency on can be
        // blacklisted out from under it.
        return api.time?.contact.get(this.model?.contact) ?? null;
    }

    /**
     * Whether the user is writing to this contact right now.
     *
     * 'paused' counts as well as 'composing': it's where a chat lands ten
     * seconds after the last keystroke, and stopping to think about the wording
     * is not a reason for the warning to disappear.
     * @returns {boolean}
     */
    isComposing() {
        return [COMPOSING, PAUSED].includes(this.model?.get('chat_state'));
    }

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
    startClockUpdates() {
        if (this._sync_timeout || this._update_interval) return;
        if (!this.getContactTime()?.differs_enough) return;

        const now = new Date();
        const ms_until_next_minute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
        this._sync_timeout = setTimeout(() => {
            this._sync_timeout = null;
            this.onTick();
            this._update_interval = setInterval(() => this.onTick(), 60000);
        }, ms_until_next_minute);
    }

    stopClockUpdates() {
        if (this._sync_timeout) clearTimeout(this._sync_timeout);
        if (this._update_interval) clearInterval(this._update_interval);
        this._sync_timeout = null;
        this._update_interval = null;
    }

    /**
     * A dismissal silences the off-hours window it was made in, not every
     * window from here on. Once their local time has left the window, forget
     * it, so that tomorrow night warns again in a session left open overnight.
     */
    onTick() {
        if (this.dismissed && !this.getContactTime()?.should_warn) this.dismissed = false;
        this.requestUpdate();
    }

    render() {
        const contact_time = this.getContactTime();
        const warn = !this.dismissed && !this.answered && this.isComposing() && contact_time?.should_warn;
        return tplEntityTimeAlert(this, warn ? contact_time : null);
    }

    /**
     * @param {MouseEvent} ev
     */
    dismiss(ev) {
        ev?.preventDefault?.();
        this.dismissed = true;
        this.requestUpdate();
    }

    /**
     * @returns {string}
     */
    getDisplayName() {
        return this.model?.contact?.getDisplayName() || this.model?.getDisplayName() || this.model?.get('jid');
    }
}
