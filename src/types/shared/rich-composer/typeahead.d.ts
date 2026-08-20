/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * The inline caret typeahead shared by the rich composers.
 * The menu that opens when the caret sits on a trigger token such as `:smi` or `@ali`.
 */
export const MAX_SUGGESTIONS: 8;
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
    constructor(host: import("lit").ReactiveElement, { sources, getHandle, container, editable }: {
        sources: TypeaheadSource[];
        getHandle: () => (import("./types").RichEditor | null);
        container: string;
        editable: string;
    });
    host: import("lit").ReactiveElement;
    sources: import("./types").TypeaheadSource[];
    getHandle: () => (import("./types").RichEditor | null);
    container_selector: string;
    editable_selector: string;
    /** @type {TypeaheadItem[]} */
    items: TypeaheadItem[];
    index: number;
    kind: string;
    query: string;
    pos: {
        left: number;
        below: number;
        above: number;
    };
    flip_up: boolean;
    max_height: number;
    /** @type {string|null} */
    dismissed: string | null;
    closed_by_blur: boolean;
    pointer_down: boolean;
    hostConnected(): void;
    _onDocPointerDown: () => void;
    _pointer_timer: number;
    hostDisconnected(): void;
    get is_open(): boolean;
    /**
     * The key an Escape dismissal is remembered under: the source plus its query,
     * NUL-joined (NUL can appear in neither), so dismissing `:sm` can never also
     * suppress `@sm`.
     */
    get dismissKey(): string;
    /**
     * The menu's inline position, as a single CSS declaration string. Anchored by its
     * bottom when flipped, so it grows upwards from the caret without needing to know its
     * own height.
     */
    get style(): string;
    /**
     * Recompute after an edit: if the caret sits on a source's trigger, show that source's
     * matches, otherwise close.
     */
    update(): Promise<void>;
    close(): void;
    /** @param {number} delta */
    move(delta: number): void;
    /** Keep the highlighted row visible when the list is long enough to scroll. */
    revealActive(): void;
    /**
     * Insert the chosen item in place of the trigger, via the active source.
     * @param {number} index
     */
    choose(index: number): void;
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
    place(): void;
    /**
     * Keyboard navigation, intercepting arrows / Enter / Tab / Escape only while the menu
     * is open so they stay away from Lexical, which handles the same keys on the same
     * element.
     * @param {KeyboardEvent} ev
     * @returns {boolean} Whether the key was consumed.
     */
    onKeyDown(ev: KeyboardEvent): boolean;
    /**
     * Close the menu whenever focus leaves the editor.
     * @param {FocusEvent} [ev]
     */
    onFocusOut(ev?: FocusEvent): void;
}
export type TypeaheadSource = import("./types").TypeaheadSource;
export type TypeaheadItem = import("./types").TypeaheadItem;
//# sourceMappingURL=typeahead.d.ts.map