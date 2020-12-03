/**
 * @module dom-navigator
 * @description A class for navigating the DOM with the keyboard
 * This module started as a fork of Rubens Mariuzzo's dom-navigator.
 * @copyright Rubens Mariuzzo, JC Brand
 */
import u from '../utils/html';
import { converse } from  "@converse/headless/core";

const { keycodes } = converse;


/**
 * Indicates if a given element is fully visible in the viewport.
 * @param { Element } el The element to check.
 * @return { Boolean } True if the given element is fully visible in the viewport, otherwise false.
 */
function inViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
    );
}

/**
 * Return the absolute offset top of an element.
 * @param el { Element } The element.
 * @return { Number } The offset top.
 */
function absoluteOffsetTop(el) {
    let offsetTop = 0;
    do {
        if (!isNaN(el.offsetTop)) {
            offsetTop += el.offsetTop;
        }
    } while ((el = el.offsetParent));
    return offsetTop;
}

/**
 * Return the absolute offset left of an element.
 * @param el { Element } The element.
 * @return { Number } The offset left.
 */
function absoluteOffsetLeft(el) {
    let offsetLeft = 0;
    do {
        if (!isNaN(el.offsetLeft)) {
            offsetLeft += el.offsetLeft;
        }
    } while ((el = el.offsetParent));
    return offsetLeft;
}


/**
 * Adds the ability to navigate the DOM with the arrow keys
 * @class DOMNavigator
 */
class DOMNavigator {
    /**
     * Directions.
     * @returns {{left: string, up: string, right: string, down: string}}
     * @constructor
     */
    static get DIRECTION () {
        return {
            down: 'down',
            end: 'end',
            home: 'home',
            left: 'left',
            right: 'right',
            up: 'up'
        };
    }

    /**
     * The default options for the DOM navigator.
     * @returns {{
     *     down: number,
     *     getSelector: null,
     *     jump_to_picked: null,
     *     jump_to_picked_direction: null,
     *     jump_to_picked_selector: string,
     *     left: number,
     *     onSelected: null,
     *     right: number,
     *     selected: string,
     *     up: number
     * }}
     */
    static get DEFAULTS () {
        return {
            home: [`${keycodes.SHIFT}+${keycodes.UP_ARROW}`],
            end: [`${keycodes.SHIFT}+${keycodes.DOWN_ARROW}`],
            up: [keycodes.UP_ARROW],
            down: [keycodes.DOWN_ARROW],
            left: [
                keycodes.LEFT_ARROW,
                `${keycodes.SHIFT}+${keycodes.TAB}`
            ],
            right: [keycodes.RIGHT_ARROW, keycodes.TAB],
            getSelector: null,
            jump_to_picked: null,
            jump_to_picked_direction: null,
            jump_to_picked_selector: 'picked',
            onSelected: null,
            selected: 'selected',
            selector: 'li',
        };
    }

    static getClosestElement (els, getDistance) {
        const next = els.reduce((prev, curr) => {
            const current_distance = getDistance(curr);
            if (current_distance < prev.distance) {
                return {
                    distance: current_distance,
                    element: curr
                };
            }
            return prev;
        }, {
            distance: Infinity
        });
        return next.element;
    }

    /**
     * Create a new DOM Navigator.
     * @param { Element } container The container of the element to navigate.
     * @param { Object } options The options to configure the DOM navigator.
     * @param { Function } options.getSelector
     * @param { Number } [options.down] - The keycode for navigating down
     * @param { Number } [options.left] - The keycode for navigating left
     * @param { Number } [options.right] - The keycode for navigating right
     * @param { Number } [options.up] - The keycode for navigating up
     * @param { String } [options.selected] - The class that should be added to the currently selected DOM element.
     * @param { String } [options.jump_to_picked] - A selector, which if
     * matched by the next element being navigated to, based on the direction
     * given by `jump_to_picked_direction`, will cause navigation
     * to jump to the element that matches the `jump_to_picked_selector`.
     * For example, this is useful when navigating to tabs. You want to
     * immediately navigate to the currently active tab instead of just
     * navigating to the first tab.
     * @param { String } [options.jump_to_picked_selector=picked] - The selector
     * indicating the currently picked element to jump to.
     * @param { String } [options.jump_to_picked_direction] - The direction for
     * which jumping to the picked element should be enabled.
     * @param { Function } [options.onSelected] - The callback function which
     * should be called when en element gets selected.
     * @constructor
     */
    constructor (container, options) {
        this.doc = window.document;
        this.container = container;
        this.scroll_container = options.scroll_container || container;
        this.options = Object.assign({}, DOMNavigator.DEFAULTS, options);
        this.init();
    }

    /**
     * Initialize the navigator.
     */
    init () {
        this.selected = null;
        this.keydownHandler = null;
        this.elements = {};
        // Create hotkeys map.
        this.keys = {};
        this.options.down.forEach(key => (this.keys[key] = DOMNavigator.DIRECTION.down));
        this.options.end.forEach(key => (this.keys[key] = DOMNavigator.DIRECTION.end));
        this.options.home.forEach(key => (this.keys[key] = DOMNavigator.DIRECTION.home));
        this.options.left.forEach(key => (this.keys[key] = DOMNavigator.DIRECTION.left));
        this.options.right.forEach(key => (this.keys[key] = DOMNavigator.DIRECTION.right));
        this.options.up.forEach(key => (this.keys[key] = DOMNavigator.DIRECTION.up));
    }

    /**
     * Enable this navigator.
     */
    enable () {
        this.getElements();
        this.keydownHandler = event => this.handleKeydown(event);
        this.doc.addEventListener('keydown', this.keydownHandler);
        this.enabled = true;
    }

    /**
     * Disable this navigator.
     */
    disable () {
        if (this.keydownHandler) {
            this.doc.removeEventListener('keydown', this.keydownHandler);
        }
        this.unselect();
        this.elements = {};
        this.enabled = false;
    }

    /**
     * Destroy this navigator removing any event registered and any other data.
     */
    destroy () {
        this.disable();
        if (this.container.domNavigator) {
            delete this.container.domNavigator;
        }
    }

    /**
     * @param {'down'|'right'|'left'|'up'} direction
     * @returns { HTMLElement }
     */
    getNextElement (direction) {
        let el;
        if (direction === DOMNavigator.DIRECTION.home) {
            el = this.getElements(direction)[0];
        } else if (direction  === DOMNavigator.DIRECTION.end) {
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
                const getDistance = el => Math.abs(el.offsetLeft - left) + Math.abs(el.offsetTop - top);
                el = DOMNavigator.getClosestElement(els, getDistance);
            } else if (direction == DOMNavigator.DIRECTION.up) {
                const left = this.selected.offsetLeft;
                const top = this.selected.offsetTop - 1;
                const els = this.elementsBefore(Infinity, top);
                const getDistance = el => Math.abs(left - el.offsetLeft) + Math.abs(top - el.offsetTop);
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
                el = this.getElements(direction)[0]
            }
        }

        if (this.options.jump_to_picked && el && el.matches(this.options.jump_to_picked) &&
            direction === this.options.jump_to_picked_direction
        ) {
            el = this.container.querySelector(this.options.jump_to_picked_selector) || el;
        }
        return el;
    }

    /**
     * Select the given element.
     * @param { Element } el The DOM element to select.
     * @param { string } [direction] The direction.
     */
    select (el, direction) {
        if (!el || el === this.selected) {
            return;
        }
        this.unselect();
        direction && this.scrollTo(el, direction);
        if (el.matches('input')) {
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
    unselect () {
        if (this.selected) {
            u.removeClass(this.options.selected, this.selected);
            delete this.selected;
        }
    }

    /**
     * Scroll the container to an element.
     * @param { HTMLElement } el The destination element.
     * @param { String } direction The direction of the current navigation.
     * @return void.
     */
    scrollTo (el, direction) {
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
                    container.scrollLeft = el.offsetLeft - container.offsetLeft - (container.offsetWidth - el.offsetWidth);
                    container.scrollTop = el.offsetTop - container.offsetTop - (container.offsetHeight - el.offsetHeight);
                    break;
                case DOMNavigator.DIRECTION.down:
                    container.scrollTop = el.offsetTop - container.offsetTop - (container.offsetHeight - el.offsetHeight);
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
                    document.body.scrollLeft = absoluteOffsetLeft(el) - document.body.offsetLeft - (document.documentElement.clientWidth - el.offsetWidth);
                    break;
                case DOMNavigator.DIRECTION.down:
                    document.body.scrollTop = absoluteOffsetTop(el) - document.body.offsetTop - (document.documentElement.clientHeight - el.offsetHeight);
                    break;
            }
        }
    }

    /**
     * Indicate if an element is in the container viewport.
     * @param { HTMLElement } el The element to check.
     * @return { Boolean } true if the given element is in the container viewport, otherwise false.
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
        if ((el.offsetLeft + el.offsetWidth - container.scrollLeft) > (container.offsetLeft + container.offsetWidth)) {
            return false;
        }
        // Check on down side.
        if ((el.offsetTop + el.offsetHeight - container.scrollTop) > (container.offsetTop + container.offsetHeight)) {
            return false;
        }
        return true;
    }

    /**
     * Find and store the navigable elements
     */
    getElements (direction) {
        const selector = this.options.getSelector ? this.options.getSelector(direction) : this.options.selector;
        if (!this.elements[selector]) {
            this.elements[selector] = Array.from(this.container.querySelectorAll(selector));
        }
        return this.elements[selector];
    }

    /**
     * Return an array of navigable elements after an offset.
     * @param { number } left The left offset.
     * @param { number } top The top offset.
     * @return { Array } An array of elements.
     */
    elementsAfter (left, top) {
        return this.getElements(DOMNavigator.DIRECTION.down).filter(el => el.offsetLeft >= left && el.offsetTop >= top);
    }

    /**
     * Return an array of navigable elements before an offset.
     * @param { number } left The left offset.
     * @param { number } top The top offset.
     * @return { Array } An array of elements.
     */
    elementsBefore (left, top) {
        return this.getElements(DOMNavigator.DIRECTION.up).filter(el => el.offsetLeft <= left && el.offsetTop <= top);
    }

    /**
     * Handle the key down event.
     * @param { Event } event The event object.
     */
    handleKeydown (ev) {
        const keys = keycodes;
        const direction = ev.shiftKey ? this.keys[`${keys.SHIFT}+${ev.which}`] : this.keys[ev.which];
        if (direction) {
            ev.preventDefault();
            ev.stopPropagation();
            const next = this.getNextElement(direction, ev);
            this.select(next, direction);
        }
    }
}

export default DOMNavigator;
