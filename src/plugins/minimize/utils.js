import { _converse, api, converse } from '@converse/headless/core';
import { __ } from 'i18n';

const u = converse.env.utils;


function getChatBoxWidth (view) {
    if (view.model.get('id') === 'controlbox') {
        // We return the width of the controlbox or its toggle,
        // depending on which is visible.
        if (u.isVisible(view)) {
            return u.getOuterWidth(view, true);
        } else {
            return u.getOuterWidth(_converse.controlboxtoggle.el, true);
        }
    } else if (!view.model.get('minimized') && u.isVisible(view)) {
        return u.getOuterWidth(view, true);
    }
    return 0;
}

function getShownChats () {
    return _converse.chatboxviews.filter(el =>
        // The controlbox can take a while to close,
        // so we need to check its state. That's why we checked the 'closed' state.
        !el.model.get('minimized') && !el.model.get('closed') && u.isVisible(el)
    );
}

function getMinimizedWidth () {
    const minimized_el = _converse.minimized_chats?.el;
    return _converse.chatboxes.pluck('minimized').includes(true) ? u.getOuterWidth(minimized_el, true) : 0;
}

function getBoxesWidth (newchat) {
    const new_id = newchat ? newchat.model.get('id') : null;
    const newchat_width = newchat ? u.getOuterWidth(newchat.el, true) : 0;
    return Object.values(_converse.chatboxviews.xget(new_id))
        .reduce((memo, view) => memo + getChatBoxWidth(view), newchat_width);
}

/**
 * This method is called when a newly created chat box will be shown.
 * It checks whether there is enough space on the page to show
 * another chat box. Otherwise it minimizes the oldest chat box
 * to create space.
 * @private
 * @method _converse.ChatBoxViews#trimChats
 * @param { _converse.ChatBoxView|_converse.ChatRoomView|_converse.ControlBoxView|_converse.HeadlinesBoxView } [newchat]
 */
export async function trimChats (newchat) {
    if (api.settings.get('no_trimming') || !api.connection.connected() || api.settings.get("view_mode") !== 'overlayed') {
        return;
    }
    const shown_chats = getShownChats();
    if (shown_chats.length <= 1) {
        return;
    }
    const body_width = u.getOuterWidth(document.querySelector('body'), true);
    if (getChatBoxWidth(shown_chats[0]) === body_width) {
        // If the chats shown are the same width as the body,
        // then we're in responsive mode and the chats are
        // fullscreen. In this case we don't trim.
        return;
    }
    await api.waitUntil('minimizedChatsInitialized');
    const minimized_el = _converse.minimized_chats?.el;
    if (minimized_el) {
        while ((getMinimizedWidth() + getBoxesWidth(newchat)) > body_width) {
            const new_id = newchat ? newchat.model.get('id') : null;
            const oldest_chat = getOldestMaximizedChat([new_id]);
            if (oldest_chat) {
                // We hide the chat immediately, because waiting
                // for the event to fire (and letting the
                // ChatBoxView hide it then) causes race
                // conditions.
                const view = _converse.chatboxviews.get(oldest_chat.get('id'));
                if (view) {
                    view.hide();
                }
                oldest_chat.minimize();
            } else {
                break;
            }
        }
    }
}

function getOldestMaximizedChat (exclude_ids) {
    // Get oldest view (if its id is not excluded)
    exclude_ids.push('controlbox');
    let i = 0;
    let model = _converse.chatboxes.sort().at(i);
    while (exclude_ids.includes(model.get('id')) || model.get('minimized') === true) {
        i++;
        model = _converse.chatboxes.at(i);
        if (!model) {
            return null;
        }
    }
    return model;
}

export function addMinimizeButtonToChat (view, buttons) {
    const data = {
        'a_class': 'toggle-chatbox-button',
        'handler': ev => view.minimize(ev),
        'i18n_text': __('Minimize'),
        'i18n_title': __('Minimize this chat'),
        'icon_class': "fa-minus",
        'name': 'minimize',
        'standalone': _converse.api.settings.get("view_mode") === 'overlayed'
    }
    const names = buttons.map(t => t.name);
    const idx = names.indexOf('close');
    return idx > -1 ? [...buttons.slice(0, idx), data, ...buttons.slice(idx)] : [data, ...buttons];
}

export function addMinimizeButtonToMUC (view, buttons) {
    const data = {
        'a_class': 'toggle-chatbox-button',
        'handler': ev => view.minimize(ev),
        'i18n_text': __('Minimize'),
        'i18n_title': __('Minimize this groupchat'),
        'icon_class': "fa-minus",
        'name': 'minimize',
        'standalone': _converse.api.settings.get("view_mode") === 'overlayed'
    }
    const names = buttons.map(t => t.name);
    const idx = names.indexOf('signout');
    return idx > -1 ? [...buttons.slice(0, idx), data, ...buttons.slice(idx)] : [data, ...buttons];
}
