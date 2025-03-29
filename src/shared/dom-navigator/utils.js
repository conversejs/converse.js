/**
 * @param {Element} el
 * @returns {boolean}
 */
export function inViewport(el) {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
}

/**
 * @param {HTMLElement} el
 * @returns {number}
 */
export function absoluteOffsetTop(el) {
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
export function absoluteOffsetLeft(el) {
    let offsetLeft = 0;
    do {
        if (!isNaN(el.offsetLeft)) {
            offsetLeft += el.offsetLeft;
        }
    } while ((el = /** @type {HTMLElement} */ (el.offsetParent)));
    return offsetLeft;
}
