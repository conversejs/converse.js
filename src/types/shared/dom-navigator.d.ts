export default DOMNavigator;
/**
 * Adds the ability to navigate the DOM with the arrow keys
 */
declare class DOMNavigator {
    /**
     * @typedef {import('./types').DOMNavigatorOptions} DOMNavigatorOptions
     * @typedef {import('./types').DOMNavigatorDirection} DOMNavigatorDirection
     */
    /**
     * @returns {DOMNavigatorDirection}
     */
    static get DIRECTION(): import("./types").DOMNavigatorDirection;
    /**
     * @returns {DOMNavigatorOptions}
     */
    static get DEFAULTS(): import("./types").DOMNavigatorOptions;
    /**
     * Gets the closest element based on the provided distance function.
     * @param {HTMLElement[]} els - The elements to evaluate.
     * @param {function(HTMLElement): number} getDistance - The function to calculate distance.
     * @returns {HTMLElement} The closest element.
     */
    static getClosestElement(els: HTMLElement[], getDistance: (arg0: HTMLElement) => number): HTMLElement;
    /**
     * Create a new DOM Navigator.
     * @param {HTMLElement} container The container of the element to navigate.
     * @param {DOMNavigatorOptions} options The options to configure the DOM navigator.
     */
    constructor(container: HTMLElement, options: import("./types").DOMNavigatorOptions);
    doc: Document;
    container: HTMLElement;
    scroll_container: HTMLElement;
    /** @type {DOMNavigatorOptions} */
    options: import("./types").DOMNavigatorOptions;
    init(): void;
    selected: any;
    keydownHandler: (ev: KeyboardEvent) => void;
    elements: {};
    keys: {};
    enable(): void;
    enabled: boolean;
    disable(): void;
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
    select(el: HTMLElement, direction?: string): void;
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
     * Finds and stores the navigable elements.
     * @param {string} [direction] - The navigation direction.
     * @returns {HTMLElement[]} The navigable elements.
     */
    getElements(direction?: string): HTMLElement[];
    /**
     * Gets navigable elements after a specified offset.
     * @param {number} left - The left offset.
     * @param {number} top - The top offset.
     * @returns {HTMLElement[]} An array of elements.
     */
    elementsAfter(left: number, top: number): HTMLElement[];
    /**
     * Gets navigable elements before a specified offset.
     * @param {number} left - The left offset.
     * @param {number} top - The top offset.
     * @returns {HTMLElement[]} An array of elements.
     */
    elementsBefore(left: number, top: number): HTMLElement[];
    /**
     * Handle the key down event.
     * @param {KeyboardEvent} ev - The event object.
     */
    handleKeydown(ev: KeyboardEvent): void;
}
//# sourceMappingURL=dom-navigator.d.ts.map