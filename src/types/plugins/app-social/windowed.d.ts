declare const WindowedListElement_base: typeof CustomElement & (new (...args: any[]) => import("@lit-labs/signals").SignalWatcherApi);
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
export class WindowedListElement extends WindowedListElement_base {
    static get properties(): {
        window_top: {
            state: boolean;
        };
    };
    window_top: number;
    window_size: number;
    scrollHandler: () => void;
    keydownHandler: (ev: KeyboardEvent) => void;
    /**
     * The full list of models the window slides over. Subclasses must implement this.
     * @returns {import('@converse/skeletor').Model[]}
     */
    get virtualizedItems(): import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>[];
    /**
     * The element whose children are the rendered item elements (used to find
     * the scroll anchor). Subclasses must implement this.
     * @returns {HTMLElement|null}
     */
    get itemsContainer(): HTMLElement;
    /**
     * The items currently within the rendered window.
     * @returns {import('@converse/skeletor').Model[]}
     */
    get windowedItems(): import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>[];
    /**
     * Re-pin the window to the top. When the underlying list changes wholesale
     * (a filter or tab change), or when the user presses Home. Drops the scroll
     * anchor first, otherwise the next `updated()` would restore the old topmost
     * item and fight the reset.
     */
    resetWindow(): void;
    /**
     * Jump to the very bottom of the whole list (the oldest post), not just the
     * rendered window, when the user presses "End". Moves the window to its last
     * page and holds the scroll at the bottom through the freshly-windowed items'
     * async height growth (see {@link #stickToBottom}).
     */
    resetToBottom(): void;
    #private;
}
import { CustomElement } from 'shared/components/element.js';
export {};
//# sourceMappingURL=windowed.d.ts.map