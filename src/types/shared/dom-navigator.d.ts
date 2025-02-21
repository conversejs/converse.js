export default DOMNavigator;
/**
 * Adds the ability to navigate the DOM with the arrow keys
 * @class DOMNavigator
 */
declare class DOMNavigator {
    /**
     * Directions.
     * @returns {import('./types').DOMNavigatorDirection}
     */
    static get DIRECTION(): import("./types").DOMNavigatorDirection;
    /**
     * The default options for the DOM navigator.
     * @returns {{
     *     home: string[],
     *     end: string[],
     *     down: number[],
     *     getSelector: null,
     *     jump_to_picked: null,
     *     jump_to_picked_direction: null,
     *     jump_to_picked_selector: string,
     *     left: number[],
     *     onSelected: null,
     *     right: number[],
     *     selected: string,
     *     selector: string,
     *     up: number[]
     * }}
     */
    static get DEFAULTS(): {
        home: string[];
        end: string[];
        down: number[];
        getSelector: null;
        jump_to_picked: null;
        jump_to_picked_direction: null;
        jump_to_picked_selector: string;
        left: number[];
        onSelected: null;
        right: number[];
        selected: string;
        selector: string;
        up: number[];
    };
    static getClosestElement(els: any, getDistance: any): any;
    /**
     * Create a new DOM Navigator.
     * @param {HTMLElement} container The container of the element to navigate.
     * @param {import('./types').DOMNavigatorOptions} options The options to configure the DOM navigator.
     */
    constructor(container: HTMLElement, options: import("./types").DOMNavigatorOptions);
    doc: Document;
    container: HTMLElement;
    scroll_container: HTMLElement;
    /** @type {import('./types').DOMNavigatorOptions} */
    options: import("./types").DOMNavigatorOptions;
    /**
     * Initialize the navigator.
     */
    init(): void;
    selected: any;
    keydownHandler: ((event: any) => void) | null | undefined;
    elements: {} | undefined;
    keys: {} | undefined;
    /**
     * Enable this navigator.
     */
    enable(): void;
    enabled: boolean | undefined;
    /**
     * Disable this navigator.
     */
    disable(): void;
    /**
     * Destroy this navigator removing any event registered and any other data.
     */
    destroy(): void;
    /**
     * @param {'down'|'right'|'left'|'up'} direction
     * @returns {HTMLElement}
     */
    getNextElement(direction: "down" | "right" | "left" | "up"): HTMLElement;
    /**
     * Select the given element.
     * @param {HTMLElement} el The DOM element to select.
     * @param {string} [direction] The direction.
     */
    select(el: HTMLElement, direction?: string | undefined): void;
    /**
     * Remove the current selection
     */
    unselect(): void;
    /**
     * Scroll the container to an element.
     * @param {HTMLElement} el The destination element.
     * @param {String} direction The direction of the current navigation.
     * @return void.
     */
    scrollTo(el: HTMLElement, direction: string): void;
    /**
     * Indicate if an element is in the container viewport.
     * @param {HTMLElement} el The element to check.
     * @return {Boolean} true if the given element is in the container viewport, otherwise false.
     */
    inScrollContainerViewport(el: HTMLElement): boolean;
    /**
     * Find and store the navigable elements
     */
    getElements(direction: any): any;
    /**
     * Return an array of navigable elements after an offset.
     * @param {number} left The left offset.
     * @param {number} top The top offset.
     * @return {Array} An array of elements.
     */
    elementsAfter(left: number, top: number): any[];
    /**
     * Return an array of navigable elements before an offset.
     * @param {number} left The left offset.
     * @param {number} top The top offset.
     * @return {Array} An array of elements.
     */
    elementsBefore(left: number, top: number): any[];
    /**
     * Handle the key down event.
     * @param {KeyboardEvent} ev - The event object.
     */
    handleKeydown(ev: KeyboardEvent): void;
}
//# sourceMappingURL=dom-navigator.d.ts.map