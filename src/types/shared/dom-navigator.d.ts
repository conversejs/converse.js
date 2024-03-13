export default DOMNavigator;
export type DOMNavigatorDirection = {
    down: string;
    end: string;
    home: string;
    left: string;
    right: string;
    up: string;
};
/**
 * @typedef {Object} DOMNavigatorDirection
 * @property {string} down
 * @property {string} end
 * @property {string} home
 * @property {string} left
 * @property {string} right
 * @property {string} up
 */
/**
 * Adds the ability to navigate the DOM with the arrow keys
 * @class DOMNavigator
 */
declare class DOMNavigator {
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
     * @typedef {Object} DOMNavigatorOptions
     * @property {Function} DOMNavigatorOptions.getSelector
     * @property {string[]} [DOMNavigatorOptions.end]
     * @property {string[]} [DOMNavigatorOptions.home]
     * @property {number[]} [DOMNavigatorOptions.down] - The keycode for navigating down
     * @property {number[]} [DOMNavigatorOptions.left] - The keycode for navigating left
     * @property {number[]} [DOMNavigatorOptions.right] - The keycode for navigating right
     * @property {number[]} [DOMNavigatorOptions.up] - The keycode for navigating up
     * @property {String} [DOMNavigatorOptions.selector]
     * @property {String} [DOMNavigatorOptions.selected] - The class that should be added
     *  to the currently selected DOM element
     * @property {String} [DOMNavigatorOptions.jump_to_picked] - A selector, which if
     *  matched by the next element being navigated to, based on the direction
     *  given by `jump_to_picked_direction`, will cause navigation
     *  to jump to the element that matches the `jump_to_picked_selector`.
     *  For example, this is useful when navigating to tabs. You want to
     *  immediately navigate to the currently active tab instead of just
     *  navigating to the first tab.
     * @property {String} [DOMNavigatorOptions.jump_to_picked_selector=picked] - The selector
     *  indicating the currently picked element to jump to.
     * @property {String} [DOMNavigatorOptions.jump_to_picked_direction] - The direction for
     *  which jumping to the picked element should be enabled.
     * @property {Function} [DOMNavigatorOptions.onSelected] - The callback function which
     *  should be called when en element gets selected.
     * @property {HTMLElement} [DOMNavigatorOptions.scroll_container]
     */
    /**
     * Create a new DOM Navigator.
     * @param {HTMLElement} container The container of the element to navigate.
     * @param {DOMNavigatorOptions} options The options to configure the DOM navigator.
     */
    constructor(container: HTMLElement, options: {
        getSelector: Function;
        end?: string[];
        home?: string[];
        /**
         * - The keycode for navigating down
         */
        down?: number[];
        /**
         * - The keycode for navigating left
         */
        left?: number[];
        /**
         * - The keycode for navigating right
         */
        right?: number[];
        /**
         * - The keycode for navigating up
         */
        up?: number[];
        selector?: string;
        /**
         * - The class that should be added
         * to the currently selected DOM element
         */
        selected?: string;
        /**
         * - A selector, which if
         * matched by the next element being navigated to, based on the direction
         * given by `jump_to_picked_direction`, will cause navigation
         * to jump to the element that matches the `jump_to_picked_selector`.
         * For example, this is useful when navigating to tabs. You want to
         * immediately navigate to the currently active tab instead of just
         * navigating to the first tab.
         */
        jump_to_picked?: string;
        /**
         * - The selector
         * indicating the currently picked element to jump to.
         */
        jump_to_picked_selector?: string;
        /**
         * - The direction for
         * which jumping to the picked element should be enabled.
         */
        jump_to_picked_direction?: string;
        /**
         * - The callback function which
         * should be called when en element gets selected.
         */
        onSelected?: Function;
        scroll_container?: HTMLElement;
    });
    doc: Document;
    container: HTMLElement;
    scroll_container: HTMLElement;
    /** @type {DOMNavigatorOptions} */
    options: {
        getSelector: Function;
        end?: string[];
        home?: string[];
        /**
         * - The keycode for navigating down
         */
        down?: number[];
        /**
         * - The keycode for navigating left
         */
        left?: number[];
        /**
         * - The keycode for navigating right
         */
        right?: number[];
        /**
         * - The keycode for navigating up
         */
        up?: number[];
        selector?: string;
        /**
         * - The class that should be added
         * to the currently selected DOM element
         */
        selected?: string;
        /**
         * - A selector, which if
         * matched by the next element being navigated to, based on the direction
         * given by `jump_to_picked_direction`, will cause navigation
         * to jump to the element that matches the `jump_to_picked_selector`.
         * For example, this is useful when navigating to tabs. You want to
         * immediately navigate to the currently active tab instead of just
         * navigating to the first tab.
         */
        jump_to_picked?: string;
        /**
         * - The selector
         * indicating the currently picked element to jump to.
         */
        jump_to_picked_selector?: string;
        /**
         * - The direction for
         * which jumping to the picked element should be enabled.
         */
        jump_to_picked_direction?: string;
        /**
         * - The callback function which
         * should be called when en element gets selected.
         */
        onSelected?: Function;
        scroll_container?: HTMLElement;
    };
    /**
     * Initialize the navigator.
     */
    init(): void;
    selected: any;
    keydownHandler: (event: any) => void;
    elements: {};
    keys: {};
    /**
     * Enable this navigator.
     */
    enable(): void;
    enabled: boolean;
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
    getNextElement(direction: 'down' | 'right' | 'left' | 'up'): HTMLElement;
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