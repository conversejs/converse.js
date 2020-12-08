import tpl_dragresize from './templates/dragresize.js';
import { _converse, api } from '@converse/headless/core';
import { render } from 'lit-html';

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

export function renderDragResizeHandles (_converse, el) {
    const flyout = el.querySelector('.box-flyout');
    const div = document.createElement('div');
    render(tpl_dragresize(), div);
    flyout.insertBefore(div, flyout.firstChild);
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
