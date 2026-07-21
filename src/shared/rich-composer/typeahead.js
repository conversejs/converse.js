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
        this.pos = { left: 0, below: 0, above: 0 };
        this.flip_up = false;
        this.max_height = 0; // Room on screen, capped inline so the menu cannot overflow it

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

    /**
     * The menu's inline position, as a single CSS declaration string. Anchored by its
     * bottom when flipped, so it grows upwards from the caret without needing to know its
     * own height.
     */
    get style() {
        const anchor = this.flip_up ? `bottom: ${this.pos.above}px` : `top: ${this.pos.below}px`;
        return `left: ${this.pos.left}px; ${anchor}; max-height: ${this.max_height}px`;
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
        this.place();
        this.host.requestUpdate();

        // Re-place once it is in the DOM and its real size is known: the first pass could
        // only work from the bounds the stylesheet guarantees. Deliberately not awaited,
        // both because callers only need the items computed and because a host that was
        // never attached (as in specs) has an updateComplete that never settles.
        this.host.updateComplete?.then(() => {
            const before = this.style;
            this.place();
            if (this.style !== before) this.host.requestUpdate();
        });
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
        if (!n) return;
        this.index = (this.index + delta + n) % n;
        this.host.requestUpdate();
        this.host.updateComplete?.then(() => this.revealActive());
    }

    /** Keep the highlighted row visible when the list is long enough to scroll. */
    revealActive() {
        const menu = /** @type {HTMLElement} */ (this.host.querySelector('.rich-ac'));
        const active = /** @type {HTMLElement} */ (menu?.querySelector('.is-active'));
        if (!menu || !active) return;

        // At either end, scroll all the way, so the menu's own padding is not left clipped
        // above the first row or below the last.
        if (this.index === 0) {
            menu.scrollTop = 0;
        } else if (this.index === this.items.length - 1) {
            menu.scrollTop = menu.scrollHeight;
        } else {
            // `nearest` scrolls by the minimum needed and leaves the page alone, and gets
            // the padding and border right, which hand-rolled offsetTop maths does not.
            active.scrollIntoView({ block: 'nearest' });
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
     * Anchor the menu to the caret, kept inside the viewport.
     *
     * The composer often sits at the bottom of the window, where a menu hanging below the
     * caret would fall off the screen, so it flips above the line when there is more room
     * there. It is also clamped horizontally, since a caret near the right edge would
     * otherwise push the menu past it.
     *
     * Called once before the menu renders (falling back to its CSS bounds) and again once
     * it is in the DOM, when its real size is known.
     */
    place() {
        const container = this.host.querySelector(this.container_selector);
        if (!container) return;

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

        // Before the first render there is nothing to measure, so fall back to the bounds
        // the stylesheet guarantees (max-height and min-width, both 14em).
        const menu = this.host.querySelector('.rich-ac')?.getBoundingClientRect();
        const height = menu?.height || 14 * 16;
        const width = menu?.width || 14 * 16;

        const room_below = window.innerHeight - rect.bottom;
        this.flip_up = room_below < height && rect.top > room_below;

        // Never taller than the room on the side it opens towards, less a small margin, and
        // never so short that it stops being a usable list.
        this.max_height = Math.max(96, (this.flip_up ? rect.top : room_below) - 8);

        // Clamped against both the container and the window: the container is not always
        // inside the viewport itself (a narrow screen can leave it hanging off the edge),
        // so keeping the menu within it is not enough on its own.
        const desired = rect.left - base.left;
        const limit = Math.min(base.width - width, window.innerWidth - width - base.left);

        this.pos = {
            left: Math.max(0, Math.min(desired, limit)),
            below: rect.bottom - base.top,
            above: base.bottom - rect.top,
        };
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
