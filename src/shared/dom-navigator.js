/**
 * @module dom-navigator
 * @description A class for navigating the DOM with the keyboard
 * This module started as a fork of Rubens Mariuzzo's dom-navigator.
 * @copyright Rubens Mariuzzo, JC Brand
 */
import u from "../utils/html";
import { converse } from "@converse/headless";

const { keycodes } = converse;

/**
 * @param {Element} el
 * @returns {boolean}
 */
function inViewport(el) {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
}

/**
 * @param {HTMLElement} el
 * @returns {number}
 */
function absoluteOffsetTop(el) {
    let offsetTop = 0;
    do {
        if (!isNaN(el.offsetTop)) {
            offsetTop += el.offsetTop;
        }
    } while ((el = /** @type {HTMLElement} */ (el.offsetParent)));
    return offsetTop;
}

/**
 * @param {HTMLElement} el
 * @returns {number}
 */
function absoluteOffsetLeft(el) {
    let offsetLeft = 0;
    do {
        if (!isNaN(el.offsetLeft)) {
            offsetLeft += el.offsetLeft;
        }
    } while ((el = /** @type {HTMLElement} */ (el.offsetParent)));
    return offsetLeft;
}

/**
 * Adds the ability to navigate the DOM with the arrow keys
 */
class DOMNavigator {
    /**
     * @typedef {import('./types').DOMNavigatorOptions} DOMNavigatorOptions
     * @typedef {import('./types').DOMNavigatorDirection} DOMNavigatorDirection
     */

    /**
     * @returns {DOMNavigatorDirection}
     */
    static get DIRECTION() {
        return {
            down: "down",
            end: "end",
            home: "home",
            left: "left",
            right: "right",
            up: "up",
        };
    }

    /**
     * @returns {DOMNavigatorOptions}
     */
    static get DEFAULTS() {
        return {
            home: [`${keycodes.SHIFT}${keycodes.UP_ARROW}`],
            end: [`${keycodes.SHIFT}${keycodes.DOWN_ARROW}`],
            up: [keycodes.UP_ARROW],
            down: [keycodes.DOWN_ARROW],
            left: [keycodes.LEFT_ARROW, `${keycodes.SHIFT}${keycodes.TAB}`],
            right: [keycodes.RIGHT_ARROW, keycodes.TAB],
            getSelector: null,
            jump_to_picked: null,
            jump_to_picked_direction: null,
            jump_to_picked_selector: "picked",
            onSelected: null,
            selected: "selected",
            selector: "li",
        };
    }

    /**
     * Gets the closest element based on the provided distance function.
     * @param {HTMLElement[]} els - The elements to evaluate.
     * @param {function(HTMLElement): number} getDistance - The function to calculate distance.
     * @returns {HTMLElement} The closest element.
     */
    static getClosestElement(els, getDistance) {
        const next = els.reduce(
            (prev, curr) => {
                const current_distance = getDistance(curr);
                if (current_distance < prev.distance) {
                    return {
                        distance: current_distance,
                        element: curr,
                    };
                }
                return prev;
            },
            {
                distance: Infinity,
                element: null,
            }
        );
        return next.element;
    }

    /**
     * Create a new DOM Navigator.
     * @param {HTMLElement} container The container of the element to navigate.
     * @param {DOMNavigatorOptions} options The options to configure the DOM navigator.
     */
    constructor(container, options) {
        this.doc = window.document;
        this.container = container;
        this.scroll_container = options.scroll_container || container;

        /** @type {DOMNavigatorOptions} */
        this.options = Object.assign({}, DOMNavigator.DEFAULTS, options);

        this.init();
    }

    init() {
        this.selected = null;
        this.keydownHandler = null;
        this.elements = {};
        // Create hotkeys map.
        this.keys = {};
        this.options.down.forEach((key) => (this.keys[key] = DOMNavigator.DIRECTION.down));
        this.options.end.forEach((key) => (this.keys[key] = DOMNavigator.DIRECTION.end));
        this.options.home.forEach((key) => (this.keys[key] = DOMNavigator.DIRECTION.home));
        this.options.left.forEach((key) => (this.keys[key] = DOMNavigator.DIRECTION.left));
        this.options.right.forEach((key) => (this.keys[key] = DOMNavigator.DIRECTION.right));
        this.options.up.forEach((key) => (this.keys[key] = DOMNavigator.DIRECTION.up));
    }

    enable() {
        this.getElements();
        this.keydownHandler = /** @param {KeyboardEvent} ev */(ev) => this.handleKeydown(ev);
        this.doc.addEventListener("keydown", this.keydownHandler);
        this.enabled = true;
    }

    disable() {
        if (this.keydownHandler) {
            this.doc.removeEventListener("keydown", this.keydownHandler);
        }
        this.unselect();
        this.elements = {};
        this.enabled = false;
    }

    destroy() {
        this.disable();
    }

    /**
     * @param {'down'|'right'|'left'|'up'} direction
     * @returns {HTMLElement}
     */
    getNextElement(direction) {
        let el;
        if (direction === DOMNavigator.DIRECTION.home) {
            el = this.getElements(direction)[0];
        } else if (direction === DOMNavigator.DIRECTION.end) {
            el = Array.from(this.getElements(direction)).pop();
        } else if (this.selected) {
            if (direction === DOMNavigator.DIRECTION.right) {
                const els = this.getElements(direction);
                el = els.slice(els.indexOf(this.selected))[1];
            } else if (direction == DOMNavigator.DIRECTION.left) {
                const els = this.getElements(direction);
                el = els.slice(0, els.indexOf(this.selected)).pop() || this.selected;
            } else if (direction == DOMNavigator.DIRECTION.down) {
                const left = this.selected.offsetLeft;
                const top = this.selected.offsetTop + this.selected.offsetHeight;
                const els = this.elementsAfter(0, top);
                const getDistance = (el) => Math.abs(el.offsetLeft - left) + Math.abs(el.offsetTop - top);
                el = DOMNavigator.getClosestElement(els, getDistance);
            } else if (direction == DOMNavigator.DIRECTION.up) {
                const left = this.selected.offsetLeft;
                const top = this.selected.offsetTop - 1;
                const els = this.elementsBefore(Infinity, top);
                const getDistance = (el) => Math.abs(left - el.offsetLeft) + Math.abs(top - el.offsetTop);
                el = DOMNavigator.getClosestElement(els, getDistance);
            } else {
                throw new Error("getNextElement: invalid direction value");
            }
        } else {
            if (direction === DOMNavigator.DIRECTION.right || direction === DOMNavigator.DIRECTION.down) {
                // If nothing is selected, we pretend that the first element is
                // selected, so we return the next.
                el = this.getElements(direction)[1];
            } else {
                el = this.getElements(direction)[0];
            }
        }

        if (
            this.options.jump_to_picked &&
            el &&
            el.matches(this.options.jump_to_picked) &&
            direction === this.options.jump_to_picked_direction
        ) {
            el = this.container.querySelector(this.options.jump_to_picked_selector) || el;
        }
        return el;
    }

    /**
     * Select the given element.
     * @param {HTMLElement} el The DOM element to select.
     * @param {string} [direction] The direction.
     */
    select(el, direction) {
        if (!el || el === this.selected) {
            return;
        }
        this.unselect();
        direction && this.scrollTo(el, direction);
        if (el.matches("input")) {
            el.focus();
        } else {
            u.addClass(this.options.selected, el);
        }
        this.selected = el;
        this.options.onSelected && this.options.onSelected(el);
    }

    /**
     * Remove the current selection
     */
    unselect() {
        if (this.selected) {
            u.removeClass(this.options.selected, this.selected);
            delete this.selected;
        }
    }

    /**
     * Scroll the container to an element.
     * @param {HTMLElement} el The destination element.
     * @param {String} direction The direction of the current navigation.
     * @return void.
     */
    scrollTo(el, direction) {
        if (!this.inScrollContainerViewport(el)) {
            const container = this.scroll_container;
            if (!container.contains(el)) {
                return;
            }
            switch (direction) {
                case DOMNavigator.DIRECTION.left:
                    container.scrollLeft = el.offsetLeft - container.offsetLeft;
                    container.scrollTop = el.offsetTop - container.offsetTop;
                    break;
                case DOMNavigator.DIRECTION.up:
                    container.scrollTop = el.offsetTop - container.offsetTop;
                    break;
                case DOMNavigator.DIRECTION.right:
                    container.scrollLeft =
                        el.offsetLeft - container.offsetLeft - (container.offsetWidth - el.offsetWidth);
                    container.scrollTop =
                        el.offsetTop - container.offsetTop - (container.offsetHeight - el.offsetHeight);
                    break;
                case DOMNavigator.DIRECTION.down:
                    container.scrollTop =
                        el.offsetTop - container.offsetTop - (container.offsetHeight - el.offsetHeight);
                    break;
            }
        } else if (!inViewport(el)) {
            switch (direction) {
                case DOMNavigator.DIRECTION.left:
                    document.body.scrollLeft = absoluteOffsetLeft(el) - document.body.offsetLeft;
                    break;
                case DOMNavigator.DIRECTION.up:
                    document.body.scrollTop = absoluteOffsetTop(el) - document.body.offsetTop;
                    break;
                case DOMNavigator.DIRECTION.right:
                    document.body.scrollLeft =
                        absoluteOffsetLeft(el) -
                        document.body.offsetLeft -
                        (document.documentElement.clientWidth - el.offsetWidth);
                    break;
                case DOMNavigator.DIRECTION.down:
                    document.body.scrollTop =
                        absoluteOffsetTop(el) -
                        document.body.offsetTop -
                        (document.documentElement.clientHeight - el.offsetHeight);
                    break;
            }
        }
    }

    /**
     * Indicate if an element is in the container viewport.
     * @param {HTMLElement} el The element to check.
     * @return {Boolean} true if the given element is in the container viewport, otherwise false.
     */
    inScrollContainerViewport(el) {
        const container = this.scroll_container;
        // Check on left side.
        if (el.offsetLeft - container.scrollLeft < container.offsetLeft) {
            return false;
        }
        // Check on top side.
        if (el.offsetTop - container.scrollTop < container.offsetTop) {
            return false;
        }
        // Check on right side.
        if (el.offsetLeft + el.offsetWidth - container.scrollLeft > container.offsetLeft + container.offsetWidth) {
            return false;
        }
        // Check on down side.
        if (el.offsetTop + el.offsetHeight - container.scrollTop > container.offsetTop + container.offsetHeight) {
            return false;
        }
        return true;
    }

    /**
     * Finds and stores the navigable elements.
     * @param {string} [direction] - The navigation direction.
     * @returns {HTMLElement[]} The navigable elements.
     */
    getElements(direction) {
        const selector = this.options.getSelector ? this.options.getSelector(direction) : this.options.selector;
        if (!this.elements[selector]) {
            this.elements[selector] = Array.from(this.container.querySelectorAll(selector));
        }
        return this.elements[selector];
    }

    /**
     * Gets navigable elements after a specified offset.
     * @param {number} left - The left offset.
     * @param {number} top - The top offset.
     * @returns {HTMLElement[]} An array of elements.
     */
    elementsAfter(left, top) {
        return this.getElements(DOMNavigator.DIRECTION.down).filter(
            (el) => el.offsetLeft >= left && el.offsetTop >= top
        );
    }

    /**
     * Gets navigable elements before a specified offset.
     * @param {number} left - The left offset.
     * @param {number} top - The top offset.
     * @returns {HTMLElement[]} An array of elements.
     */
    elementsBefore(left, top) {
        return this.getElements(DOMNavigator.DIRECTION.up).filter((el) => el.offsetLeft <= left && el.offsetTop <= top);
    }

    /**
     * Handle the key down event.
     * @param {KeyboardEvent} ev - The event object.
     */
    handleKeydown(ev) {
        const keys = keycodes;
        const direction = ev.shiftKey ? this.keys[`${keys.SHIFT}+${ev.key}`] : this.keys[ev.key];
        if (direction) {
            ev.preventDefault();
            ev.stopPropagation();
            const next = this.getNextElement(direction);
            this.select(next, direction);
        }
    }
}

export default DOMNavigator;
