/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * The inline caret typeahead shared by the rich composers.
 * The menu that opens when the caret sits on a trigger token such as `:smi` or `@ali`.
 */

export const MAX_SUGGESTIONS = 8;

/**
 * @typedef {import('./types').TypeaheadSource} TypeaheadSource
 * @typedef {import('./types').TypeaheadItem} TypeaheadItem
 */

export class TypeaheadController {
    /**
     * @param {import('lit').ReactiveElement} host - The composer element.
     * @param {object} opts
     * @param {TypeaheadSource[]} opts.sources - Tried in order; the first whose trigger the
     *      caret sits on wins. Triggers must be mutually exclusive.
     * @param {() => (import('./types').RichEditor|null)} opts.getHandle - The editor handle,
     *      read lazily since it is only created when the composer is first focused.
     * @param {string} opts.container - Selector for the element the menu is positioned in.
     * @param {string} opts.editable - Selector for the contenteditable host.
     */
    constructor(host, { sources, getHandle, container, editable }) {
        this.host = host;
        this.sources = sources;
        this.getHandle = getHandle;
        this.container_selector = container;
        this.editable_selector = editable;

        /** @type {TypeaheadItem[]} */
        this.items = [];
        this.index = 0;
        this.kind = ''; // The source the menu is currently showing for
        this.query = ''; // The query the current items were built for
        this.pos = { left: 0, top: 0 };

        // The dismissal key (see `dismissKey`) the user pressed Escape on. The menu stays
        // closed for it until the query changes, so a later editor update cannot re-open
        // the same trigger.
        /** @type {string|null} */
        this.dismissed = null;

        // Set for the current event dispatch only, when a blur closed an open menu, so an
        // Escape keydown arriving in the same dispatch can tell the menu was open for it.
        this.closed_by_blur = false;

        this.pointer_down = false; // Whether a pointer recently went down anywhere in the document

        host.addController?.(this);
    }

    hostConnected() {
        // Capture phase, so no handler can swallow it first.
        this._onDocPointerDown = () => {
            this.pointer_down = true;
            clearTimeout(this._pointer_timer);
            this._pointer_timer = setTimeout(() => (this.pointer_down = false), 400);
        };
        document.addEventListener('pointerdown', this._onDocPointerDown, { capture: true });
    }

    hostDisconnected() {
        document.removeEventListener('pointerdown', this._onDocPointerDown, { capture: true });
        clearTimeout(this._pointer_timer);
    }

    get is_open() {
        return this.items.length > 0;
    }

    /**
     * The key an Escape dismissal is remembered under: the source plus its query,
     * NUL-joined (NUL can appear in neither), so dismissing `:sm` can never also
     * suppress `@sm`.
     */
    get dismissKey() {
        return `${this.kind}\x00${this.query}`;
    }

    /** The menu's inline position, as a single CSS declaration string. */
    get style() {
        return `left: ${this.pos.left}px; top: ${this.pos.top}px`;
    }

    /**
     * Recompute after an edit: if the caret sits on a source's trigger, show that source's
     * matches, otherwise close.
     */
    async update() {
        const handle = this.getHandle();
        let source = null;
        let query = null;
        for (const candidate of this.sources) {
            // N.B. sources normalize "no trigger" to null; an empty-string query is valid
            // (a bare `@` lists everyone).
            query = candidate.getQuery(handle);
            if (query !== null) {
                source = candidate;
                break;
            }
        }
        if (!source) {
            // The caret left every trigger, so forget any earlier Escape dismissal.
            this.dismissed = null;
            return this.close();
        }

        // Honour an Escape dismissal: stay closed until the query actually changes.
        const dismissal = `${source.kind}\x00${query}`;
        if (dismissal === this.dismissed) return this.close();
        this.dismissed = null;

        const items = await source.getItems(query);

        // The caret may have moved, or the menu been dismissed, while items loaded.
        if (source.getQuery(this.getHandle()) !== query || this.dismissed === dismissal) return;

        // Only open while the user is actually typing in the editor. Lexical keeps its
        // selection (and so the trigger query) across a blur, so without this a pending
        // update could re-open the menu after focus has moved elsewhere.
        const host_el = /** @type {HTMLElement} */ (this.host.querySelector(this.editable_selector));
        if (host_el && host_el !== document.activeElement && !host_el.contains(document.activeElement)) {
            return this.close();
        }

        if (!items.length) return this.close();

        this.kind = source.kind;
        this.query = query;
        this.items = items;
        this.index = 0;
        this.pos = this.caretPosition();
        this.host.requestUpdate();
    }

    close() {
        if (this.items.length) {
            this.items = [];
            this.host.requestUpdate();
        }
    }

    /** @param {number} delta */
    move(delta) {
        const n = this.items.length;
        if (n) {
            this.index = (this.index + delta + n) % n;
            this.host.requestUpdate();
        }
    }

    /**
     * Insert the chosen item in place of the trigger, via the active source.
     * @param {number} index
     */
    choose(index) {
        const item = this.items[index];
        const source = this.sources.find((s) => s.kind === this.kind);
        if (!item || !source) return;

        source.choose(this.getHandle(), this.query, item);
        this.close();
        this.getHandle()?.focus();
    }

    /**
     * The caret's position relative to the container, so the menu can be anchored just
     * below the current line. Falls back to the editable's box when a caret rect is
     * unavailable.
     * @returns {{ left: number, top: number }}
     */
    caretPosition() {
        const container = this.host.querySelector(this.container_selector);
        if (!container) return { left: 0, top: 0 };

        const base = container.getBoundingClientRect();
        const sel = window.getSelection();

        let rect = null;
        if (sel && sel.rangeCount) {
            const range = sel.getRangeAt(0).cloneRange();
            range.collapse(true);
            rect = range.getBoundingClientRect();
        }
        if (!rect || (!rect.width && !rect.height && !rect.left && !rect.top)) {
            rect = this.host.querySelector(this.editable_selector)?.getBoundingClientRect() ?? base;
        }
        return { left: rect.left - base.left, top: rect.bottom - base.top };
    }

    /**
     * Keyboard navigation, intercepting arrows / Enter / Tab / Escape only while the menu
     * is open so they stay away from Lexical, which handles the same keys on the same
     * element.
     * @param {KeyboardEvent} ev
     * @returns {boolean} Whether the key was consumed.
     */
    onKeyDown(ev) {
        if (!this.items.length) {
            if (ev.key === 'Escape' && this.closed_by_blur) {
                // This Escape's own blur (an extension blurring the editor before we ran)
                // already closed the menu: finish the dismissal by reclaiming focus, and
                // consume the event so the editor's own blur-on-Escape doesn't immediately
                // re-blur. A bare Escape (no menu involved) falls through instead, and
                // blurs. That is the keyboard user's escape hatch out of the editor.
                this.closed_by_blur = false;
                this.dismissed = this.dismissKey;
                ev.preventDefault();
                ev.stopImmediatePropagation();
                this.getHandle()?.focus();
                return true;
            }
            return false;
        }

        switch (ev.key) {
            case 'ArrowDown':
                this.move(1);
                break;
            case 'ArrowUp':
                this.move(-1);
                break;
            case 'Enter':
            case 'Tab':
                this.choose(this.index);
                break;
            case 'Escape':
                // Remember the dismissal so a later editor update can't re-open it, and put
                // focus back in the editor with the caret where it was.
                this.dismissed = this.dismissKey;
                this.close();
                this.getHandle()?.focus();
                break;
            default:
                return false;
        }
        ev.preventDefault();
        // Stop Lexical's own keydown handler (registered on the same element) too.
        ev.stopImmediatePropagation();
        return true;
    }

    /**
     * Close the menu whenever focus leaves the editor.
     * @param {FocusEvent} [ev]
     */
    onFocusOut(ev) {
        const had_menu = this.items.length > 0;
        if (had_menu) {
            // Remember, only until the current event dispatch has run its course, that a
            // blur (not a pick or dismissal) closed the menu. If this blur was itself caused
            // by an Escape press (a vim-style browser extension blurring the focused element
            // at document level, before our keydown handler gets to run), the keydown
            // handler must still treat that Escape as "dismiss the menu" and reclaim focus.
            this.closed_by_blur = true;
            setTimeout(() => (this.closed_by_blur = false));
        }

        this.close();

        // Vimium (and kin) can swallow the Escape keydown entirely, so the page never sees
        // the key. This blur is the only signal. A keyboard-initiated blur to nowhere while
        // the menu was open can only be such a dismissal, so reclaim focus for the editor. A
        // pointer-initiated blur (a click elsewhere), a focus move to a real element, or the
        // window itself losing focus must all genuinely take focus away instead.
        if (had_menu && !ev?.relatedTarget && !this.pointer_down) {
            const dismissed = this.dismissKey;
            setTimeout(() => {
                if (document.hasFocus() && document.activeElement === document.body) {
                    this.dismissed = dismissed;
                    this.getHandle()?.focus();
                }
            });
        }
    }
}
