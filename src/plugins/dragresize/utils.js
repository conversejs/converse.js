import { api, converse } from '@converse/headless';

const { u } = converse.env;

export function registerGlobalEventHandlers() {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

export function unregisterGlobalEventHandlers() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
}

/**
 * This function registers mousedown and mouseup events hadlers to
 * all iframes in the DOM when converse UI resizing events are called
 * to prevent mouse drag stutter effect which is bad user experience.
 * @param {Element} e - dragging node element.
 */
export function dragresizeOverIframeHandler(e) {
    const iframes = Array.from(document.getElementsByTagName('iframe'));
    for (const iframe of iframes) {
        e.addEventListener(
            'mousedown',
            () => {
                iframe.style.pointerEvents = 'none';
            },
            { once: true }
        );

        e.addEventListener(
            'mouseup',
            () => {
                iframe.style.pointerEvents = 'initial';
            },
            { once: true }
        );
    }
}

/**
 * @typedef {Object} ResizingData
 * @property {HTMLElement} chatbox
 * @property {string} direction
 */
const resizing = {};

/**
 * @returns {string}
 */
export function getResizingDirection() {
    return resizing.direction;
}

/**
 * @param {MouseEvent} ev
 * @param {boolean} [trigger=true]
 */
export function onStartVerticalResize(ev, trigger = true) {
    if (!api.settings.get('allow_dragresize')) {
        return true;
    }
    ev.preventDefault();
    // Record element attributes for mouseMove().
    const flyout = u.ancestor(ev.target, '.box-flyout');
    const style = window.getComputedStyle(flyout);
    const chatbox_el = flyout.parentElement;
    chatbox_el.height = parseInt(style.height.replace(/px$/, ''), 10);
    resizing.chatbox = chatbox_el;
    resizing.direction = 'top';
    chatbox_el.prev_pageY = ev.pageY;

    if (trigger) {
        /**
         * Triggered once the user starts to vertically resize a {@link _converse.ChatBoxView}
         * @event _converse#startVerticalResize
         * @example _converse.api.listen.on('startVerticalResize', (view) => { ... });
         */
        api.trigger('startVerticalResize', chatbox_el);
    }
}

/**
 * @param {MouseEvent} ev
 * @param {boolean} [trigger=true]
 */
export function onStartHorizontalResize(ev, trigger = true) {
    if (!api.settings.get('allow_dragresize')) {
        return true;
    }
    ev.preventDefault();
    const flyout = u.ancestor(ev.target, '.box-flyout');
    const style = window.getComputedStyle(flyout);

    const chatbox_el = flyout.parentElement;
    chatbox_el.width = parseInt(style.width.replace(/px$/, ''), 10);
    resizing.chatbox = chatbox_el;
    resizing.direction = 'left';
    chatbox_el.prev_pageX = ev.pageX;
    if (trigger) {
        /**
         * Triggered once the user starts to horizontally resize a {@link _converse.ChatBoxView}
         * @event _converse#startHorizontalResize
         * @example _converse.api.listen.on('startHorizontalResize', (view) => { ... });
         */
        api.trigger('startHorizontalResize', chatbox_el);
    }
}

/**
 * @param {MouseEvent} ev
 */
export function onStartDiagonalResize(ev) {
    onStartHorizontalResize(ev, false);
    onStartVerticalResize(ev, false);
    resizing.direction = 'topleft';
    /**
     * Triggered once the user starts to diagonally resize a {@link _converse.ChatBoxView}
     * @event _converse#startDiagonalResize
     * @example _converse.api.listen.on('startDiagonalResize', (view) => { ... });
     */
    api.trigger('startDiagonalResize', this);
}

/**
 * Applies some resistance to `value` around the `default_value`.
 * If value is close enough to `default_value`, then it is returned, otherwise
 * `value` is returned.
 * @param {number} value
 * @param {number} default_value
 * @returns {number}
 */
export function applyDragResistance(value, default_value) {
    if (value === undefined) {
        return undefined;
    } else if (default_value === undefined) {
        return value;
    }
    const resistance = 10;
    if (value !== default_value && Math.abs(value - default_value) < resistance) {
        return default_value;
    }
    return value;
}

/**
 * @param {MouseEvent} ev
 */
export function onMouseMove(ev) {
    if (!resizing.chatbox || !api.settings.get('allow_dragresize')) {
        return true;
    }
    ev.preventDefault();
    resizing.chatbox.resizeChatBox(ev);
}

/**
 * @param {MouseEvent} ev
 */
export function onMouseUp(ev) {
    if (!resizing.chatbox || !api.settings.get('allow_dragresize')) {
        return true;
    }
    ev.preventDefault();
    const default_width = resizing.chatbox.model.get('default_width');
    const default_height = resizing.chatbox.model.get('default_height');
    const height = applyDragResistance(resizing.chatbox.height, default_height);
    const width = applyDragResistance(resizing.chatbox.width, default_width);

    if (height !== default_height || width !== default_width) {
        u.safeSave(resizing.chatbox.model, { height, width });
    } else {
        u.safeSave(resizing.chatbox.model, { height: undefined, width: undefined });
    }
    delete resizing.chatbox;
    delete resizing.direction;
}

/**
 * @param {import('@converse/headless/types/shared/chatbox').default} chatbox
 * @param {boolean} should_destroy
 */
export function shouldDestroyOnClose(chatbox, should_destroy) {
    if (chatbox.get('height') || chatbox.get('width')) {
        return false;
    }
    return should_destroy;
}
