export default class SplitResize extends CustomElement {
    pair: import("./types").ResizablePair & Record<string, any>;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * Helper function gets a property from the properties object, with a default fallback
     * @param {Record<string, any>} options
     * @param {string} propName
     * @param {any} def
     */
    getOption(options: Record<string, any>, propName: string, def: any): any;
    /**
     * @param {string} dim
     * @param {string|number} size
     * @param {string|number} gutSize
     * @returns {Record<string, string|number>}
     */
    getElementStyle(dim: string, size: string | number, gutSize: string | number): Record<string, string | number>;
    /**
     * @param {string} dim
     * @param {number} gutSize
     * @returns {Record<string, string>}
     */
    defaultGutterStyleFn(dim: string, gutSize: number): Record<string, string>;
    /**
     * @param {number} gutterSize
     * @param {boolean} isFirst
     * @param {boolean} isLast
     * @param {string} gutterAlign
     * @returns {number}
     */
    getGutterSize(gutterSize: number, isFirst: boolean, isLast: boolean, gutterAlign: string): number;
    /**
     * @param {HTMLElement} el
     * @param {number} size
     * @param {string} gutSize
     */
    setElementSize(el: HTMLElement, size: number, gutSize: string): void;
    getSizes(): number[];
    /**
     * @param {MouseEvent} e
     */
    getMousePosition(e: MouseEvent): any;
    /**
     * Actually adjust the size of elements `a` and `b` to `offset` while dragging.
     * calc is used to allow calc(percentage + gutterpx) on the whole split instance,
     * which allows the viewport to be resized without additional logic.
     * Element a's size is the same as offset. b's size is total size - a size.
     * Both sizes are calculated from the initial parent percentage,
     * then the gutter size is subtracted.
     *
     * @param {number} offset
     */
    adjust(offset: number): void;
    /**
     * Handles the dragging logic for resizing elements.
     *
     * The logic is quite simple:
     *
     * 1. Ignore if the pair is not dragging.
     * 2. Get the offset of the event.
     * 3. Snap offset to min if within snappable range (within min + snapOffset).
     * 4. Actually adjust each element in the pair to offset.
     *
     * ---------------------------------------------------------------------
     * |    | <- a.minSize               ||              b.minSize -> |    |
     * |    |  | <- this.snapOffset      ||     this.snapOffset -> |  |    |
     * |    |  |                         ||                        |  |    |
     * |    |  |                         ||                        |  |    |
     * ---------------------------------------------------------------------
     * | <- this.start                                        this.size -> |
     *
     * @param {MouseEvent} e
     * @param {object} options
     */
    drag(e: MouseEvent, options: object): void;
    /**
     * Cache some important sizes when drag starts, so we don't have to do that
     * continuously:
     *
     * `size`: The total size of the pair. First + second + first gutter + second gutter.
     * `start`: The leading side of the first element.
     *
     * ------------------------------------------------
     * |      aGutterSize -> |||                      |
     * |                     |||                      |
     * |                     |||                      |
     * |                     ||| <- bGutterSize       |
     * ------------------------------------------------
     * | <- start                             size -> |
     *
     * @param {import('./types').ResizablePair} pair
     */
    calculateSizes(pair: import("./types").ResizablePair): void;
    /**
     * @param {HTMLElement} el
     */
    innerSize(el: HTMLElement): any;
    /**
     * When specifying percentage sizes that are less than the computed
     * size of the element minus the gutter, the lesser percentages must be increased
     * (and decreased from the other elements) to make space for the pixels
     * subtracted by the gutters.
     */
    /**
     * @param {number[]} sizesToTrim
     * @returns {number[]}
     */
    trimToMin(sizesToTrim: number[]): number[];
    /**
     * stopDragging is very similar to startDragging in reverse.
     * @param {Object} options
     */
    stopDragging(options: any): void;
    /**
     * startDragging calls `calculateSizes` to store the initial size in the pair object.
     * It also adds event listeners for mouse/touch events,
     * and prevents selection while dragging to avoid selecting text.
     * @param {MouseEvent} e
     * @param {Object} options
     */
    startDragging(e: MouseEvent, options: any): void;
    /**
     * @param {import('./types').ResizableElement} element
     */
    adjustToMin(element: import("./types").ResizableElement): void;
    /**
     * @param {Array<number>} newSizes
     */
    setSizes(newSizes: Array<number>): void;
    /**
     * The main function to initialize a split.
     *
     * Each pair of elements, resizable relative to one another, is handled independently.
     * Dragging the gutter between two elements only changes the dimensions of elements in that pair.
     *
     * The basic sequence:
     *
     * 1. Set defaults to something sane. `options` doesn't have to be passed at all.
     * 2. Initialize a bunch of strings based on the direction we're splitting.
     *    A lot of the behavior in the rest of the library is parameterized down to
     *    rely on CSS strings and classes.
     * 3. Define the dragging helper functions, and a few helpers to go with them.
     * 4. Loop through the elements while pairing them off. Every pair gets an
     *    `pair` object and a gutter.
     * 5. Actually size the pair elements, insert gutters and attach event listeners.
     *
     * @param {HTMLElement[]} els
     */
    setupSplit(els: HTMLElement[], options?: {}): void;
    parent: HTMLElement;
    minSizes: any[];
    gutterSize: any;
    gutterAlign: any;
    dragInterval: any;
    direction: any;
    cursor: any;
    dimension: string;
    clientAxis: string;
    position: string;
    positionEnd: string;
    clientSize: string;
    elements: import("./types").ResizableElement[];
    /**
     * @param {HTMLElement[]} els
     * @param {HTMLElement} el
     * @param {number} i
     * @param {object} options
     * @returns {import('./types').ResizableElement}
     */
    createElement(els: HTMLElement[], el: HTMLElement, i: number, options: object): import("./types").ResizableElement;
    /**
     * @param {object} options
     */
    createPair(options: object): void;
}
import { CustomElement } from './element.js';
//# sourceMappingURL=split-resize.d.ts.map