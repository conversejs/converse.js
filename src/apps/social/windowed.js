/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { SignalWatcher } from '@lit-labs/signals';
import { CustomElement } from 'shared/components/element.js';
import { isEditableTarget } from '../../utils/html.js';

const WINDOW_SIZE = 50; // Number of items rendered to the DOM at a time.
const WINDOW_DELTA = 5; // How many items the window moves at a time.

/**
 * Base class implementing a virtualized, top-anchored post list. Only a window
 * of {@link WindowedListElement#window_size} items is rendered to the DOM, and
 * the window follows the viewport as the user scrolls. The feed analogue of the
 * bottom-anchored windowing in `shared/chat/chat-content.js`.
 *
 * Chat gets scroll anchoring for free from `flex-direction: column-reverse`,
 * but a feed reads top-down (newest first), so when content above the viewport
 * changes we keep the reading position ourselves. The topmost visible item is
 * pinned where it is, re-picked on every user scroll, and the scroll position
 * is corrected whenever it moves (right after our own re-renders), and (via a
 * ResizeObserver on the items container) when items change height *after* the
 * fact, since an item element first renders empty and only gets its real
 * height in its own later update cycle. Native CSS scroll anchoring is
 * disabled on the scroller (`overflow-anchor: none`) so the two don't both
 * compensate.
 */
export class WindowedListElement extends SignalWatcher(CustomElement) {
    static get properties() {
        return {
            ...super.properties,
            window_top: { state: true },
        };
    }

    /** @type {{ el: Element, top: number }|null} */
    #anchor = null;

    /** @type {ResizeObserver|null} */
    #resize_observer = null;

    /** @type {HTMLElement|null} */
    #observed_container = null;

    #scroll_pending = false;

    // While set (during an "End"-button jump-to-bottom), the scroll is held at the
    // bottom instead of pinning the top anchor.
    #pin_bottom = false;
    // The bottom offset we last forced. A smaller scrollTop can only be the user
    // scrolling up (our own corrections and item growth never move the scroll up),
    // which releases it.
    #pin_scroll_top = 0;

    constructor() {
        super();

        // Index (into virtualizedItems) of the first (newest) rendered item.
        // While zero, the window is pinned to the top, so new posts render live.
        this.window_top = 0;
        this.window_size = WINDOW_SIZE;

        this.scrollHandler = () => {
            // A user scroll upward releases an End jump-to-bottom pin. Our own
            // corrections and item growth only ever push the scroll down to the
            // bottom, so a decrease in scrollTop can only be the user.
            if (this.#pin_bottom && this.scrollTop < this.#pin_scroll_top - 2) this.#pin_bottom = false;

            // The scroll (the user's, or our own correction) settled on a new
            // position. Re-pick the top anchor there (unless we're holding the
            // bottom), synchronously, so content arriving before the next frame
            // can't displace it uncorrected.
            if (!this.#pin_bottom) this.#captureAnchor();

            if (this.#scroll_pending) return;
            this.#scroll_pending = true;

            requestAnimationFrame(() => {
                this.#scroll_pending = false;
                this.#setWindow();
            });
        };

        // Home / End jump to the very top / bottom of the whole list
        this.keydownHandler = /** @param {KeyboardEvent} ev */ (ev) => this.#onKeyDown(ev);
    }

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('scroll', this.scrollHandler, { passive: true });

        // On the document, not this element. After a wheel/trackpad scroll focus
        // sits on <body>, which wouldn't reach a listener on the element.
        document.addEventListener('keydown', this.keydownHandler);

        // Corrects the reading position when rendered items change height after
        // our own update has already run.
        this.#resize_observer = new ResizeObserver(() => this.#restoreAnchor());
    }

    disconnectedCallback() {
        this.removeEventListener('scroll', this.scrollHandler);
        document.removeEventListener('keydown', this.keydownHandler);
        this.#resize_observer?.disconnect();
        this.#resize_observer = null;
        this.#observed_container = null;
        this.#anchor = null;
        super.disconnectedCallback();
    }

    /**
     * The full list of models the window slides over. Subclasses must implement this.
     * @returns {import('@converse/skeletor').Model[]}
     */
    get virtualizedItems() {
        throw new Error('WindowedListElement subclasses must implement virtualizedItems');
    }

    /**
     * The element whose children are the rendered item elements (used to find
     * the scroll anchor). Subclasses must implement this.
     * @returns {HTMLElement|null}
     */
    get itemsContainer() {
        return null;
    }

    /**
     * The items currently within the rendered window.
     * @returns {import('@converse/skeletor').Model[]}
     */
    get windowedItems() {
        const items = this.virtualizedItems;

        // Clamp so the window stays full (when possible) even if the list
        // shrank, e.g. after unfollowing a feed while scrolled down.
        const start = Math.min(this.window_top, Math.max(0, items.length - this.window_size));
        return items.slice(start, start + this.window_size);
    }

    /**
     * Re-pin the window to the top. When the underlying list changes wholesale
     * (a filter or tab change), or when the user presses Home. Drops the scroll
     * anchor first, otherwise the next `updated()` would restore the old topmost
     * item and fight the reset.
     */
    resetWindow() {
        this.#anchor = null;
        this.#pin_bottom = false;
        this.window_top = 0;
        this.scrollTop = 0;
    }

    /**
     * Jump to the very bottom of the whole list (the oldest post), not just the
     * rendered window, when the user presses "End". Moves the window to its last
     * page and holds the scroll at the bottom through the freshly-windowed items'
     * async height growth (see {@link #stickToBottom}).
     */
    resetToBottom() {
        const total = this.virtualizedItems.length;
        this.#anchor = null;
        this.#pin_bottom = true;

        // Start below any value the pre-render scroll position can clamp to, so a
        // shrink-on-swap doesn't read as the user scrolling up before we settle.
        this.#pin_scroll_top = 0;
        this.window_top = Math.max(0, total - this.window_size);
        this.#stickToBottom();
    }

    /**
     * Hold the scroll at the bottom while the last page renders. A ResizeObserver
     * can't do this. Swapping one full window for another of the same height
     * leaves the container's net size unchanged, so it may never fire, even
     * though `scrollTop` needs correcting as each item grows from its empty first
     * render. So re-assert the bottom each frame until the height settles (or the
     * user scrolls up, which clears {@link #pin_bottom} via the scroll handler).
     */
    #stickToBottom() {
        let last_height = -1;
        let stable = 0;
        const step = () => {
            if (!this.#pin_bottom) return; // The user scrolled away.

            this.scrollTop = this.scrollHeight;
            this.#pin_scroll_top = this.scrollTop;

            if (this.scrollHeight === last_height) {
                if (++stable >= 2) {
                    this.#pin_bottom = false; // Settled at the bottom; a one-shot jump.
                    return;
                }
            } else {
                stable = 0;
                last_height = this.scrollHeight;
            }
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    /**
     * @param {import('lit').PropertyValues} changed
     */
    updated(changed) {
        super.updated(changed);
        this.#restoreAnchor();

        // (Re)observe the items container, whose height changes whenever a
        // rendered item's does. Also fires once on `observe`, which is harmless
        // (the restore is a no-op when nothing moved).
        const container = this.itemsContainer;
        if (container && container !== this.#observed_container) {
            this.#resize_observer?.disconnect();
            this.#resize_observer?.observe(container);
            this.#observed_container = container;
        }
    }

    /**
     * Move the window based on where the viewport is within the scrollable
     * area, mirroring the edge-delta approach of chat-content's `#setWindow`,
     * but anchored to the top (the newest post) instead of the bottom.
     */
    #setWindow() {
        const total = this.virtualizedItems.length;
        if (total <= this.window_size) {
            if (this.window_top !== 0) this.window_top = 0;
            return;
        }

        // The amount before an actual edge where we are close enough to want to
        // move the window. Set to 20% of the scrollable height.
        const delta = Math.ceil(this.scrollHeight / 5);
        const max_top = total - this.window_size;

        if (Math.floor(this.scrollTop) === 0) {
            this.window_top = 0;
        } else if (this.scrollHeight - this.scrollTop - this.clientHeight <= delta) {
            // Nearing the bottom. Slide the window towards older items.
            this.window_top = Math.min(max_top, this.window_top + WINDOW_DELTA);
        } else if (this.scrollTop <= delta) {
            // Nearing the top. Slide the window towards newer items.
            this.window_top = Math.max(0, this.window_top - WINDOW_DELTA);
        }
    }

    /**
     * (Re)pin the reading position. Remember the topmost (partially) visible
     * item element and where it currently sits. Only ever called from the
     * scroll handler.
     */
    #captureAnchor() {
        this.#anchor = null;
        if (this.scrollTop <= 0) return;

        const container = this.itemsContainer;
        if (!container) return;

        const viewport_top = this.getBoundingClientRect().top;

        for (const child of container.children) {
            const rect = child.getBoundingClientRect();
            if (rect.bottom > viewport_top) {
                this.#anchor = { el: child, top: rect.top };
                return;
            }
        }
    }

    /**
     * Put the anchor element back where it was pinned, so content changing
     * above the viewport doesn't move what the user is reading. The correction
     * scrolls, which re-picks the anchor at the restored position (via the
     * scroll handler). A no-op while an End jump holds the bottom (no anchor).
     */
    #restoreAnchor() {
        const anchor = this.#anchor;
        if (!anchor) return;

        if (!anchor.el.isConnected) {
            this.#anchor = null;
            return;
        }

        const delta = anchor.el.getBoundingClientRect().top - anchor.top;
        if (delta) this.scrollTop += delta;
    }

    /**
     * Jump to the top (Home) or bottom (End) of the whole list. Skipped while a
     * text field (the compose box or a search input) has focus, so the keys still
     * move the caret there, and for Alt/Meta chords (OS/browser shortcuts).
     * @param {KeyboardEvent} ev
     */
    #onKeyDown(ev) {
        if (ev.altKey || ev.metaKey) return;
        if (ev.key !== 'Home' && ev.key !== 'End') return;
        if (isEditableTarget(ev.target)) return;

        ev.preventDefault();
        if (ev.key === 'Home') this.resetWindow();
        else this.resetToBottom();
    }
}
