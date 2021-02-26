import { _converse, api, converse } from '@converse/headless/core';

const { u } = converse.env;


export function onStartVerticalResize (ev, trigger = true) {
    if (!api.settings.get('allow_dragresize')) {
        return true;
    }
    ev.preventDefault();
    // Record element attributes for mouseMove().
    const flyout = u.ancestor(ev.target, '.box-flyout');
    const style = window.getComputedStyle(flyout);
    const chatbox_el = flyout.parentElement;
    chatbox_el.height = parseInt(style.height.replace(/px$/, ''), 10);
    _converse.resizing = {
        'chatbox': chatbox_el,
        'direction': 'top'
    };
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

export function onStartHorizontalResize (ev, trigger = true) {
    if (!api.settings.get('allow_dragresize')) {
        return true;
    }
    ev.preventDefault();
    const flyout = u.ancestor(ev.target, '.box-flyout');
    const style = window.getComputedStyle(flyout);
    const chatbox_el = flyout.parentElement;
    chatbox_el.width = parseInt(style.width.replace(/px$/, ''), 10);
    _converse.resizing = {
        'chatbox': chatbox_el,
        'direction': 'left'
    };
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

export function onStartDiagonalResize (ev) {
    onStartHorizontalResize(ev, false);
    onStartVerticalResize(ev, false);
    _converse.resizing.direction = 'topleft';
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
 * @param { Integer } value
 * @param { Integer } default_value
 * @returns { Integer }
 */
export function applyDragResistance (value, default_value) {
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

export function onMouseMove (ev) {
    if (!_converse.resizing || !api.settings.get('allow_dragresize')) {
        return true;
    }
    ev.preventDefault();
    _converse.resizing.chatbox.resizeChatBox(ev);
}

export function onMouseUp (ev) {
    if (!_converse.resizing || !api.settings.get('allow_dragresize')) {
        return true;
    }
    ev.preventDefault();
    const height = applyDragResistance(
        _converse.resizing.chatbox.height,
        _converse.resizing.chatbox.model.get('default_height')
    );
    const width = applyDragResistance(
        _converse.resizing.chatbox.width,
        _converse.resizing.chatbox.model.get('default_width')
    );
    if (api.connection.connected()) {
        _converse.resizing.chatbox.model.save({ 'height': height });
        _converse.resizing.chatbox.model.save({ 'width': width });
    } else {
        _converse.resizing.chatbox.model.set({ 'height': height });
        _converse.resizing.chatbox.model.set({ 'width': width });
    }
    _converse.resizing = null;
}
