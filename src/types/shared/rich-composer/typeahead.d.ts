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
        top: number;
    };
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
    /** The menu's inline position, as a single CSS declaration string. */
    get style(): string;
    /**
     * Recompute after an edit: if the caret sits on a source's trigger, show that source's
     * matches, otherwise close.
     */
    update(): Promise<void>;
    close(): void;
    /** @param {number} delta */
    move(delta: number): void;
    /**
     * Insert the chosen item in place of the trigger, via the active source.
     * @param {number} index
     */
    choose(index: number): void;
    /**
     * The caret's position relative to the container, so the menu can be anchored just
     * below the current line. Falls back to the editable's box when a caret rect is
     * unavailable.
     * @returns {{ left: number, top: number }}
     */
    caretPosition(): {
        left: number;
        top: number;
    };
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