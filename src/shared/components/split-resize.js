/**
 * @copyright Nathan Cahill and the Converse.js contributors
 * @description Based on the split.js library from Nathan Cahill.
 * @license MIT Licence
 */
import { html } from 'lit';
import { api, u } from '@converse/headless';
import { CustomElement } from './element.js';

import './styles/split-resize.scss';

const gutterStartDragging = '_a';
const aGutterSize = '_b';
const bGutterSize = '_c';
const HORIZONTAL = 'horizontal';
const NOOP = () => false;

const global = typeof window !== 'undefined' ? window : null;

export default class SplitResize extends CustomElement {
    initialize() {
        super.initialize();
    }

    constructor() {
        super();
        this.pair = null;
    }

    render() {
        return html`<div class="gutter gutter-horizontal"></div>`;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.pair.gutter.removeEventListener('mousedown', this.pair[gutterStartDragging]);
        this.pair.gutter.removeEventListener('touchstart', this.pair[gutterStartDragging]);
    }

    /**
     * @param {Map<string, any>} changed
     */
    updated(changed) {
        super.updated(changed);
        if (!this.pair) {
            this.setupSplit([
                /** @type {HTMLElement} */ (this.previousElementSibling),
                /** @type {HTMLElement} */ (this.nextElementSibling),
            ]);
        }
    }

    /**
     * Helper function gets a property from the properties object, with a default fallback
     */
    getOption(options, propName, def) {
        const value = options[propName];
        if (value !== undefined) {
            return value;
        }
        return def;
    }

    getElementStyle(dim, size, gutSize) {
        const style = {};

        if (!u.isString(size)) {
            style[dim] = `calc(${size}% - ${gutSize}px)`;
        } else {
            style[dim] = size;
        }

        return style;
    }

    defaultGutterStyleFn(dim, gutSize) {
        return { [dim]: `${gutSize}px` };
    }

    getGutterSize(gutterSize, isFirst, isLast, gutterAlign) {
        if (isFirst) {
            if (gutterAlign === 'end') {
                return 0;
            }
            if (gutterAlign === 'center') {
                return gutterSize / 2;
            }
        } else if (isLast) {
            if (gutterAlign === 'start') {
                return 0;
            }
            if (gutterAlign === 'center') {
                return gutterSize / 2;
            }
        }

        return gutterSize;
    }

    /**
     * @param {HTMLElement} el
     * @param {string} size
     * @param {string} gutSize
     */
    setElementSize(el, size, gutSize) {
        // Allows setting sizes via numbers (ideally), or if you must,
        // by string, like '300px'. This is less than ideal, because it breaks
        // the fluid layout that `calc(% - px)` provides. You're on your own if you do that,
        // make sure you calculate the gutter size by hand.
        const style = this.getElementStyle(this.dimension, size, gutSize);

        Object.keys(style).forEach((prop) => {
            // eslint-disable-next-line no-param-reassign
            el.style[prop] = style[prop];
        });
    }

    getSizes() {
        return this.elements.map((element) => element.size);
    }

    /**
     * Supports touch events, but not multitouch, so only the first
     * finger `touches[0]` is counted.
     * @param {MouseEvent} e
     */
    getMousePosition(e) {
        if ('touches' in e) return e.touches[0][this.clientAxis];
        return e[this.clientAxis];
    }

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
    adjust(offset) {
        const a = this.elements[this.pair.a];
        const b = this.elements[this.pair.b];
        const percentage = a.size + b.size;

        a.size = (offset / this.pair.size) * percentage;
        b.size = percentage - (offset / this.pair.size) * percentage;

        this.setElementSize(a.element, a.size, this.pair[aGutterSize]);
        this.setElementSize(b.element, b.size, this.pair[bGutterSize]);
    }

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
    drag(e, options) {
        let offset;
        const a = this.elements[this.pair.a];
        const b = this.elements[this.pair.b];

        if (!this.pair.dragging) return;

        // Get the offset of the event from the first side of the
        // pair `pair.start`. Then offset by the initial position of the
        // mouse compared to the gutter size.
        offset = this.getMousePosition(e) - this.pair.start + (this.pair[aGutterSize] - this.pair.dragOffset);

        if (this.dragInterval > 1) {
            offset = Math.round(offset / this.dragInterval) * this.dragInterval;
        }

        // If within snapOffset of min or max, set offset to min or max.
        // snapOffset buffers a.minSize and b.minSize, so logic is opposite for both.
        // Include the appropriate gutter sizes to prevent overflows.
        if (offset <= a.minSize + a.snapOffset + this.pair[aGutterSize]) {
            offset = a.minSize + this.pair[aGutterSize];
        } else if (offset >= this.pair.size - (b.minSize + b.snapOffset + this.pair[bGutterSize])) {
            offset = this.pair.size - (b.minSize + this.pair[bGutterSize]);
        }

        if (offset >= a.maxSize - a.snapOffset + this.pair[aGutterSize]) {
            offset = a.maxSize + this.pair[aGutterSize];
        } else if (offset <= this.pair.size - (b.maxSize - b.snapOffset + this.pair[bGutterSize])) {
            offset = this.pair.size - (b.maxSize + this.pair[bGutterSize]);
        }

        // Actually adjust the size.
        this.adjust(offset);

        // Call the drag callback continously. Don't do anything too intensive
        // in pair callback.
        this.getOption(options, 'onDrag', NOOP)(this.getSizes());
    }

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
     * @param {ResizablePair} pair
     */
    calculateSizes(pair) {
        // Figure out the parent size minus padding.
        const a = this.elements[pair.a].element;
        const b = this.elements[pair.b].element;

        const aBounds = a.getBoundingClientRect();
        const bBounds = b.getBoundingClientRect();

        pair.size = aBounds[this.dimension] + bBounds[this.dimension] + pair[aGutterSize] + pair[bGutterSize];
        pair.start = aBounds[this.position];
        pair.end = aBounds[this.positionEnd];
    }

    /**
     * @param {HTMLElement} el
     */
    innerSize(el) {
        // Return nothing if getComputedStyle is not supported (< IE9)
        // Or if parent el has no layout yet
        if (!getComputedStyle) return null;

        const computedStyle = getComputedStyle(el);
        if (!computedStyle) return null;

        let size = el[this.clientSize];
        if (size === 0) return null;

        if (this.direction === HORIZONTAL) {
            size -= parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight);
        } else {
            size -= parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom);
        }
        return size;
    }

    /**
     * When specifying percentage sizes that are less than the computed
     * size of the element minus the gutter, the lesser percentages must be increased
     * (and decreased from the other elements) to make space for the pixels
     * subtracted by the gutters.
     */
    trimToMin(sizesToTrim) {
        // Try to get inner size of parent element.
        // If it's no supported, return original sizes.
        const parentSize = this.innerSize(this.parent);
        if (parentSize === null) {
            return sizesToTrim;
        }

        if (this.minSizes.reduce((a, b) => a + b, 0) > parentSize) {
            return sizesToTrim;
        }

        // Keep track of the excess pixels, the amount of pixels over the desired percentage
        // Also keep track of the elements with pixels to spare, to decrease after if needed
        let excessPixels = 0;
        const toSpare = [];

        const pixelSizes = sizesToTrim.map((size, i) => {
            // Convert requested percentages to pixel sizes
            const pixelSize = (parentSize * size) / 100;
            const elementGutterSize = this.getGutterSize(
                this.gutterSize,
                i === 0,
                i === sizesToTrim.length - 1,
                this.gutterAlign
            );
            const elementMinSize = this.minSizes[i] + elementGutterSize;

            // If element is too smal, increase excess pixels by the difference
            // and mark that it has no pixels to spare
            if (pixelSize < elementMinSize) {
                excessPixels += elementMinSize - pixelSize;
                toSpare.push(0);
                return elementMinSize;
            }

            // Otherwise, mark the pixels it has to spare and return it's original size
            toSpare.push(pixelSize - elementMinSize);
            return pixelSize;
        });

        // If nothing was adjusted, return the original sizes
        if (excessPixels === 0) {
            return sizesToTrim;
        }

        return pixelSizes.map((pixelSize, i) => {
            let newPixelSize = pixelSize;

            // While there's still pixels to take, and there's enough pixels to spare,
            // take as many as possible up to the total excess pixels
            if (excessPixels > 0 && toSpare[i] - excessPixels > 0) {
                const takenPixels = Math.min(excessPixels, toSpare[i] - excessPixels);

                // Subtract the amount taken for the next iteration
                excessPixels -= takenPixels;
                newPixelSize = pixelSize - takenPixels;
            }

            // Return the pixel size adjusted as a percentage
            return (newPixelSize / parentSize) * 100;
        });
    }

    /**
     * stopDragging is very similar to startDragging in reverse.
     * @param {Object} options
     */
    stopDragging(options) {
        const a = this.elements[this.pair.a].element;
        const b = this.elements[this.pair.b].element;

        if (this.pair.dragging) {
            this.getOption(options, 'onDragEnd', NOOP)(this.getSizes());
        }

        this.pair.dragging = false;

        // Remove the stored event listeners. This is why we store them.
        global.removeEventListener('mouseup', this.pair.stop);
        global.removeEventListener('touchend', this.pair.stop);
        global.removeEventListener('touchcancel', this.pair.stop);
        global.removeEventListener('mousemove', this.pair.move);
        global.removeEventListener('touchmove', this.pair.move);

        // Clear bound function references
        this.pair.stop = null;
        this.pair.move = null;

        a.removeEventListener('selectstart', NOOP);
        a.removeEventListener('dragstart', NOOP);
        b.removeEventListener('selectstart', NOOP);
        b.removeEventListener('dragstart', NOOP);

        a.style.userSelect = '';
        a.style.pointerEvents = '';

        b.style.userSelect = '';
        b.style.pointerEvents = '';

        this.pair.gutter.style.cursor = '';
        this.pair.parent.style.cursor = '';
        document.body.style.cursor = '';
    }

    /**
     * startDragging calls `calculateSizes` to store the initial size in the pair object.
     * It also adds event listeners for mouse/touch events,
     * and prevents selection while dragging to avoid selecting text.
     * @param {MouseEvent} e
     * @param {Object} options
     */
    startDragging(e, options) {
        // Right-clicking can't start dragging.
        if ('button' in e && e.button !== 0) {
            return;
        }

        // Alias frequently used variables to save space. 200 bytes.
        const a = this.elements[this.pair.a].element;
        const b = this.elements[this.pair.b].element;

        // Call the onDragStart callback.
        if (!this.pair.dragging) {
            this.getOption(options, 'onDragStart', NOOP)(this.getSizes());
        }

        // Don't actually drag the element. We emulate this in the drag function.
        e.preventDefault();

        // Set the dragging property of the this.pair object.
        this.pair.dragging = true;

        // Create two event listeners bound to the same this.pair object and store
        // them in the this.pair object.
        this.pair.stop = () => this.stopDragging(options);
        this.pair.move = /** @param {MouseEvent} e */ (e) => this.drag(e, options);

        // All the binding. `window` gets the stop events in case we drag out of the elements.
        global.addEventListener('mouseup', this.pair.stop);
        global.addEventListener('touchend', this.pair.stop);
        global.addEventListener('touchcancel', this.pair.stop);
        global.addEventListener('mousemove', this.pair.move);
        global.addEventListener('touchmove', this.pair.move);

        // Disable selection. Disable!
        a.addEventListener('selectstart', NOOP);
        a.addEventListener('dragstart', NOOP);
        b.addEventListener('selectstart', NOOP);
        b.addEventListener('dragstart', NOOP);

        a.style.userSelect = 'none';
        a.style.pointerEvents = 'none';

        b.style.userSelect = 'none';
        b.style.pointerEvents = 'none';

        // Set the cursor at multiple levels
        this.pair.gutter.style.cursor = this.cursor;
        this.pair.parent.style.cursor = this.cursor;
        document.body.style.cursor = this.cursor;

        // Cache the initial sizes of the this.pair.
        this.calculateSizes(this.pair);

        // Determine the position of the mouse compared to the gutter
        this.pair.dragOffset = this.getMousePosition(e) - this.pair.end;
    }

    /**
     * @param {Object} element
     */
    adjustToMin(element) {
        this.calculateSizes(this.pair);
        this.adjust(this.pair.size - element.minSize - this.pair[bGutterSize]);
    }

    /**
     * @param {Array<number>} newSizes
     */
    setSizes(newSizes) {
        const trimmed = this.trimToMin(newSizes);
        trimmed.forEach((newSize, i) => {
            if (i > 0) {
                const a = this.elements[this.pair.a];
                const b = this.elements[this.pair.b];

                a.size = trimmed[i - 1];
                b.size = newSize;

                this.setElementSize(a.element, a.size, this.pair[aGutterSize]);
                this.setElementSize(b.element, b.size, this.pair[bGutterSize]);
            }
        });
    }

    /**
     * The main function to initialize a split.
     *
     * Each pair of elements, resizable relative to one another, is handled independently.
     * Dragging the gutter between two elements only changes the dimensions of elements in that pair.
     *
     * A pair object is shaped like this:
     *
     * @typedef {Object} ResizablePair
     * @property {(0|1)} a
     * @property {(0|1)} b
     * @property {('horizontal'|'vertical')} direction
     * @property {boolean} dragging
     * @property {number} aMin
     * @property {number} bMin
     * @property {number} dragOffset
     * @property {number} size
     * @property {number} start
     * @property {number} end
     * @property {HTMLElement} gutter
     * @property {HTMLElement} parent
     * @property {(this: Window, ev: Event) => any} stop
     * @property {(this: Window, ev: Event) => any} move
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
    setupSplit(els, options = {}) {
        // Allow HTMLCollection to be used as an argument
        els = Array.from(els);

        // All DOM elements in the split should have a common parent. We can grab
        // the first elements parent and hope users read the docs because the
        // behavior will be whacky otherwise.
        const firstElement = els[0];
        this.parent = firstElement.parentElement;

        // Standardize minSize and maxSize to an array if it isn't already.
        // This allows minSize and maxSize to be passed as a number.
        const minSize = this.getOption(options, 'minSize', 100);
        this.minSizes = Array.isArray(minSize) ? minSize : els.map(() => minSize);

        // Get other options
        const expandToMin = this.getOption(options, 'expandToMin', false);
        this.gutterSize = this.getOption(options, 'gutterSize', 5);
        this.gutterAlign = this.getOption(options, 'gutterAlign', 'center');
        this.dragInterval = this.getOption(options, 'dragInterval', 1);
        this.direction = this.getOption(options, 'direction', HORIZONTAL);
        this.cursor = this.getOption(options, 'cursor', this.direction === HORIZONTAL ? 'col-resize' : 'row-resize');

        // 2. Initialize a bunch of strings based on the direction we're splitting.
        // A lot of the behavior in the rest of the library is paramatized down to
        // rely on CSS strings and classes.
        if (this.direction === HORIZONTAL) {
            this.dimension = 'width';
            this.clientAxis = 'clientX';
            this.position = 'left';
            this.positionEnd = 'right';
            this.clientSize = 'clientWidth';
        } else if (this.direction === 'vertical') {
            this.dimension = 'height';
            this.clientAxis = 'clientY';
            this.position = 'top';
            this.positionEnd = 'bottom';
            this.clientSize = 'clientHeight';
        }

        // Create pair and element objects. Each pair has an index reference to
        // elements `a` and `b` of the pair (first and second elements).
        // Loop through the elements while pairing them off. Every pair gets a
        // `pair` object and a gutter.
        //
        // Basic logic:
        //
        // - Starting with the second element `i > 0`, create `pair` objects with
        //   `a = i - 1` and `b = i`
        // - Set gutter sizes based on the _pair_ being first/last. The first and last
        //   pair have gutterSize / 2, since they only have one half gutter, and not two.
        // - Create gutter elements and add event listeners.
        // - Set the size of the elements, minus the gutter sizes.
        //
        // -----------------------------------------------------------------------
        // |     i=0     |         i=1         |        i=2       |      i=3     |
        // |             |                     |                  |              |
        // |           pair 0                pair 1             pair 2           |
        // |             |                     |                  |              |
        // -----------------------------------------------------------------------
        this.elements = els.map((el, i) => this.createElement(els, el, i, options));

        this.elements.forEach((element) => {
            const computedSize = element.element.getBoundingClientRect()[this.dimension];
            if (computedSize < element.minSize) {
                if (expandToMin) {
                    this.adjustToMin(element);
                } else {
                    element.minSize = computedSize;
                }
            }
        });

        this.createPair(options);
    }

    /**
     * @param {HTMLElement[]} els
     * @param {HTMLElement} el
     * @param {number} i
     * @param {object} options
     */
    createElement(els, el, i, options) {
        // Set default options.sizes to equal percentages of the parent element.
        let sizes = this.getOption(options, 'sizes') || els.map(() => 100 / els.length);
        // adjust sizes to ensure percentage is within min size and gutter.
        sizes = this.trimToMin(sizes);

        const maxSize = this.getOption(options, 'maxSize', Infinity);
        const maxSizes = Array.isArray(maxSize) ? maxSize : els.map(() => maxSize);

        const snapOffset = this.getOption(options, 'snapOffset', 30);
        const snapOffsets = Array.isArray(snapOffset) ? snapOffset : els.map(() => snapOffset);

        return {
            element: el,
            size: sizes[i],
            minSize: this.minSizes[i],
            maxSize: maxSizes[i],
            snapOffset: snapOffsets[i],
            i,
        };
    }

    /**
     * @param {object} options
     */
    createPair(options) {
        const parentStyle = getComputedStyle ? getComputedStyle(this.parent) : null;
        const parentFlexDirection = parentStyle ? parentStyle.flexDirection : null;

        // Create the pair object with its metadata.
        this.pair = /** @type {ResizablePair} */ ({
            a: 0,
            b: 1,
            dragging: false,
            direction: this.direction,
            parent: this.parent,
        });

        this.pair[aGutterSize] = this.getGutterSize(this.gutterSize, true, false, this.gutterAlign);
        this.pair[bGutterSize] = this.getGutterSize(this.gutterSize, false, true, this.gutterAlign);

        // if the parent has a reverse flex-direction, switch the pair elements.
        if (parentFlexDirection === 'row-reverse' || parentFlexDirection === 'column-reverse') {
            const temp = this.pair.a;
            this.pair.a = this.pair.b;
            this.pair.b = temp;
        }

        const gutterElement = /** @type {HTMLElement} */ (this.firstElementChild);
        // Save bound event listener for removal later
        this.pair[gutterStartDragging] = (e) => this.startDragging(e, options);

        // Attach bound event listener
        this.addEventListener('mousedown', this.pair[gutterStartDragging]);
        this.addEventListener('touchstart', this.pair[gutterStartDragging]);

        this.pair.gutter = gutterElement;
    }
}

api.elements.define('converse-split-resize', SplitResize);
