/**
 * @typedef {import('@converse/headless').MUC} MUC
 * @typedef {import('@converse/headless').ChatBox} ChatBox
 * @typedef {import('plugins/chatview/chat').default} ChatView
 * @typedef {import('plugins/muc-views/muc').default} MUCView
 * @typedef {import('plugins/controlbox/controlbox').default} ControlBoxView
 * @typedef {import('plugins/headlines-view/view').default} HeadlinesFeedView
 */
import { _converse, api, u, constants } from '@converse/headless';
import { __ } from 'i18n';

const { ACTIVE } = constants;

/**
 * @param {ChatBox|MUC} chat
 */
export function initializeChat (chat) {
    chat.on('change:hidden', () => onMinimizedChanged(chat));

    if (chat.get('id') === 'controlbox') {
        return;
    }
    chat.save({
        'hidden': !!chat.get('hidden'),
        'time_minimized': chat.get('time_minimized'),
    });
}

function getChatBoxWidth (view) {
    if (view.model.get('id') === 'controlbox') {
        // We return the width of the controlbox or its toggle,
        // depending on which is visible.
        if (u.isVisible(view)) {
            return u.getOuterWidth(view, true);
        } else {
            const toggle = document.querySelector('converse-controlbox-toggle');
            return toggle ? u.getOuterWidth(toggle, true) : 0;
        }
    } else if (!view.model.get('hidden') && u.isVisible(view)) {
        return u.getOuterWidth(view, true);
    }
    return 0;
}

function getShownChats () {
    return _converse.state.chatboxviews.filter(el =>
        // The controlbox can take a while to close,
        // so we need to check its state. That's why we checked the 'closed' state.
        !el.model.get('hidden') && !el.model.get('closed') && u.isVisible(el)
    );
}

function getMinimizedWidth () {
    const minimized_el = document.querySelector('converse-minimized-chats');
    return _converse.state.chatboxes.pluck('hidden').includes(true) ? u.getOuterWidth(minimized_el, true) : 0;
}

function getBoxesWidth (newchat) {
    const new_id = newchat ? newchat.model.get('id') : null;
    const newchat_width = newchat ? u.getOuterWidth(newchat, true) : 0;
    return Object.values(_converse.state.chatboxviews.xget(new_id))
        .reduce((memo, view) => memo + getChatBoxWidth(view), newchat_width);
}

/**
 * This method is called when a newly created chat box will be shown.
 * It checks whether there is enough space on the page to show
 * another chat box. Otherwise it minimizes the oldest chat box
 * to create space.
 * @param {ChatView|MUCView|ControlBoxView|HeadlinesFeedView} [newchat]
 */
export function trimChats (newchat) {
    if (api.settings.get('no_trimming') || api.settings.get("view_mode") !== 'overlayed') {
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
    const minimized_el = document.querySelector('converse-minimized-chats');
    if (minimized_el) {
        while ((getMinimizedWidth() + getBoxesWidth(newchat)) > body_width) {
            const new_id = newchat ? newchat.model.get('id') : null;
            const oldest_chat = getOldestMaximizedChat([new_id]);
            if (oldest_chat) {
                const model = _converse.state.chatboxes.get(oldest_chat.get('id'));
                model?.save('hidden', true);
                minimize(oldest_chat);
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
    let model = _converse.state.chatboxes.sort().at(i);
    while (exclude_ids.includes(model.get('id')) || model.get('hidden') === true) {
        i++;
        model = _converse.state.chatboxes.at(i);
        if (!model) {
            return null;
        }
    }
    return model;
}

export function addMinimizeButtonToChat (view, buttons) {
    const data = {
        'a_class': 'toggle-chatbox-button',
        'handler': ev => minimize(ev, view.model),
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
        'handler': ev => minimize(ev, view.model),
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


export function maximize (ev, chatbox) {
    if (ev?.preventDefault) {
        ev.preventDefault();
    } else {
        chatbox = ev;
    }
    u.safeSave(chatbox, {
        'hidden': false,
        'time_opened': new Date().getTime()
    });
}

export function minimize (ev, model) {
    if (ev?.preventDefault) {
        ev.preventDefault();
    } else {
        model = ev;
    }
    u.safeSave(model, {
        'hidden': true,
        'time_minimized': new Date().toISOString()
    });
}

/**
 * Will trigger {@link _converse#chatBoxMaximized}
 * @param {ChatBox|MUC} model
 */
function onMaximized (model) {
    if (!model.isScrolledUp()) {
        model.clearUnreadMsgCounter();
    }
    model.setChatState(ACTIVE);
    /**
     * Triggered when a previously minimized chat gets maximized
     * @event _converse#chatBoxMaximized
     * @type {ChatBox|MUC}
     * @example _converse.api.listen.on('chatBoxMaximized', view => { ... });
     */
    api.trigger('chatBoxMaximized', model);
}

/**
 * Handler which gets called when a {@link _converse#ChatBox} has it's
 * `minimized` property set to true.
 * @param {ChatBox|MUC} model
 *
 * Will trigger {@link _converse#chatBoxMinimized}
 */
function onMinimized (model) {
    /**
     * Triggered when a previously maximized chat gets Minimized
     * @event _converse#chatBoxMinimized
     * @type { ChatBox|MUC }
     * @example _converse.api.listen.on('chatBoxMinimized', view => { ... });
     */
    api.trigger('chatBoxMinimized', model);
}

/**
 * @param {ChatBox|MUC} model
 */
export function onMinimizedChanged (model) {
    if (model.get('hidden')) {
        onMinimized(model);
    } else {
        onMaximized(model);
    }
}
