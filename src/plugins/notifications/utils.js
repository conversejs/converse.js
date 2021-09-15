import Favico from 'favico.js-slevomat';
import log from '@converse/headless/log';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core.js';
import { isEmptyMessage } from '@converse/headless/utils/core.js';

const { Strophe } = converse.env;
const supports_html5_notification = 'Notification' in window;

converse.env.Favico = Favico;

let favicon;


export function isMessageToHiddenChat (attrs) {
    return _converse.isTestEnv() || (_converse.chatboxes.get(attrs.from)?.isHidden() ?? false);
}

export function areDesktopNotificationsEnabled () {
    return _converse.isTestEnv() || (
        supports_html5_notification &&
        api.settings.get('show_desktop_notifications') &&
        Notification.permission === 'granted'
    );
}

export function clearFavicon () {
    favicon = null;
    navigator.clearAppBadge?.()
        .catch(e => log.error("Could not clear unread count in app badge " + e));
}

export function updateUnreadFavicon () {
    if (api.settings.get('show_tab_notifications')) {
        favicon = favicon ?? new converse.env.Favico({ type: 'circle', animation: 'pop' });
        const chats = _converse.chatboxes.models;
        const num_unread = chats.reduce((acc, chat) => acc + (chat.get('num_unread') || 0), 0);
        favicon.badge(num_unread);
        navigator.setAppBadge?.(num_unread)
            .catch(e => log.error("Could set unread count in app badge - " + e));
    }
}


function isReferenced (references, muc_jid, nick) {
    const check = r => [_converse.bare_jid, `${muc_jid}/${nick}`].includes(r.uri.replace(/^xmpp:/, ''));
    return references.reduce((acc, r) => acc || check(r), false);
}


/**
 * Is this a group message for which we should notify the user?
 * @private
 * @param { MUCMessageAttributes } attrs
 */
export async function shouldNotifyOfGroupMessage (attrs) {
    if (!attrs?.body && !attrs?.message) {
        // attrs.message is used by 'info' messages
        return false;
    }
    const jid = attrs.from;
    const muc_jid = attrs.from_muc;
    const notify_all = api.settings.get('notify_all_room_messages');
    const room = _converse.chatboxes.get(muc_jid);
    const resource = Strophe.getResourceFromJid(jid);
    const sender = (resource && Strophe.unescapeNode(resource)) || '';
    let is_mentioned = false;
    const nick = room.get('nick');

    if (api.settings.get('notify_nicknames_without_references')) {
        is_mentioned = new RegExp(`\\b${nick}\\b`).test(attrs.body);
    }

    const is_not_mine = sender !== nick;
    const should_notify_user =
        notify_all === true ||
        (Array.isArray(notify_all) && notify_all.includes(muc_jid)) ||
        isReferenced(attrs.references, muc_jid, nick) ||
        is_mentioned;

    if (is_not_mine && !!should_notify_user) {
        /**
         * *Hook* which allows plugins to run further logic to determine
         * whether a notification should be sent out for this message.
         * @event _converse#shouldNotifyOfGroupMessage
         * @example
         *  api.listen.on('shouldNotifyOfGroupMessage', (should_notify) => {
         *      return should_notify && flurb === floob;
         *  });
         */
        const should_notify = await api.hook('shouldNotifyOfGroupMessage', attrs, true);
        return should_notify;
    }
    return false;
}

async function shouldNotifyOfInfoMessage (attrs) {
    if (!attrs.from_muc) {
        return false;
    }
    const room = await api.rooms.get(attrs.from_muc);
    if (!room) {
        return false;
    }
    const nick = room.get('nick');
    const muc_jid = attrs.from_muc;
    const notify_all = api.settings.get('notify_all_room_messages');
    return (
        notify_all === true ||
        (Array.isArray(notify_all) && notify_all.includes(muc_jid)) ||
        isReferenced(attrs.references, muc_jid, nick)
    );
}

/**
 * @private
 * @async
 * @method shouldNotifyOfMessage
 * @param { MessageData|MUCMessageData } data
 */
function shouldNotifyOfMessage (data) {
    const { attrs } = data;
    if (!attrs || attrs.is_forwarded) {
        return false;
    }
    if (attrs['type'] === 'groupchat') {
        return shouldNotifyOfGroupMessage(attrs);
    } else if (attrs['type'] === 'info') {
        return shouldNotifyOfInfoMessage(attrs);
    } else if (attrs.is_headline) {
        // We want to show notifications for headline messages.
        return isMessageToHiddenChat(attrs);
    }
    const is_me = Strophe.getBareJidFromJid(attrs.from) === _converse.bare_jid;
    return (
        !isEmptyMessage(attrs) &&
        !is_me &&
        (api.settings.get('show_desktop_notifications') === 'all' || isMessageToHiddenChat(attrs))
    );
}

export function showFeedbackNotification (data) {
    if (data.klass === 'error' || data.klass === 'warn') {
        const n = new Notification(data.subject, {
            body: data.message,
            lang: _converse.locale,
            icon: api.settings.get('notification_icon')
        });
        setTimeout(n.close.bind(n), 5000);
    }
}

/**
 * Creates an HTML5 Notification to inform of a change in a
 * contact's chat state.
 */
function showChatStateNotification (contact) {
    if (api.settings.get('chatstate_notification_blacklist')?.includes(contact.jid)) {
        // Don't notify if the user is being ignored.
        return;
    }
    const chat_state = contact.presence.get('show');
    let message = null;
    if (chat_state === 'offline') {
        message = __('has gone offline');
    } else if (chat_state === 'away') {
        message = __('has gone away');
    } else if (chat_state === 'dnd') {
        message = __('is busy');
    } else if (chat_state === 'online') {
        message = __('has come online');
    }
    if (message === null) {
        return;
    }
    const n = new Notification(contact.getDisplayName(), {
        body: message,
        lang: _converse.locale,
        icon: api.settings.get('notification_icon')
    });
    setTimeout(() => n.close(), 5000);
}


/**
 * Shows an HTML5 Notification with the passed in message
 * @private
 * @param { MessageData|MUCMessageData } data
 */
function showMessageNotification (data) {
    const { attrs } = data;
    if (attrs.is_error) {
        return;
    }

    if (!areDesktopNotificationsEnabled()) {
        return;
    }
    let title, roster_item;
    const full_from_jid = attrs.from;
    const from_jid = Strophe.getBareJidFromJid(full_from_jid);
    if (attrs.type == 'info') {
        title = attrs.message;
    } else if (attrs.type === 'headline') {
        if (!from_jid.includes('@') || api.settings.get('allow_non_roster_messaging')) {
            title = __('Notification from %1$s', from_jid);
        } else {
            return;
        }
    } else if (!from_jid.includes('@')) {
        // workaround for Prosody which doesn't give type "headline"
        title = __('Notification from %1$s', from_jid);
    } else if (attrs.type === 'groupchat') {
        title = __('%1$s says', Strophe.getResourceFromJid(full_from_jid));
    } else {
        if (_converse.roster === undefined) {
            log.error('Could not send notification, because roster is undefined');
            return;
        }
        roster_item = _converse.roster.get(from_jid);
        if (roster_item !== undefined) {
            title = __('%1$s says', roster_item.getDisplayName());
        } else {
            if (api.settings.get('allow_non_roster_messaging')) {
                title = __('%1$s says', from_jid);
            } else {
                return;
            }
        }
    }

    let body;
    if (attrs.type == 'info') {
        body = attrs.reason;
    } else {
        body = attrs.is_encrypted ? attrs.plaintext : attrs.body;
        if (!body) {
            return;
        }
    }

    const n = new Notification(title, {
        'body': body,
        'lang': _converse.locale,
        'icon': api.settings.get('notification_icon'),
        'requireInteraction': !api.settings.get('notification_delay')
    });
    if (api.settings.get('notification_delay')) {
        setTimeout(() => n.close(), api.settings.get('notification_delay'));
    }
    n.onclick = function (event) {
        event.preventDefault();
        window.focus();
        const chat = _converse.chatboxes.get(from_jid);
        chat.maybeShow(true);
    }
}

function playSoundNotification () {
    if (api.settings.get('play_sounds') && window.Audio !== undefined) {
        const audioOgg = new Audio(api.settings.get('sounds_path') + 'msg_received.ogg');
        const canPlayOgg = audioOgg.canPlayType('audio/ogg');
        if (canPlayOgg === 'probably') {
            return audioOgg.play();
        }
        const audioMp3 = new Audio(api.settings.get('sounds_path') + 'msg_received.mp3');
        const canPlayMp3 = audioMp3.canPlayType('audio/mp3');
        if (canPlayMp3 === 'probably') {
            audioMp3.play();
        } else if (canPlayOgg === 'maybe') {
            audioOgg.play();
        } else if (canPlayMp3 === 'maybe') {
            audioMp3.play();
        }
    }
}

/**
 * Event handler for the on('message') event. Will call methods
 * to play sounds and show HTML5 notifications.
 */
export async function handleMessageNotification (data) {
    if (!await shouldNotifyOfMessage(data)) {
        return false;
    }
    /**
     * Triggered when a notification (sound or HTML5 notification) for a new
     * message has will be made.
     * @event _converse#messageNotification
     * @type { MessageData|MUCMessageData}
     * @example _converse.api.listen.on('messageNotification', data => { ... });
     */
    api.trigger('messageNotification', data);
    playSoundNotification();
    showMessageNotification(data);
}

export function handleFeedback (data) {
    if (areDesktopNotificationsEnabled(true)) {
        showFeedbackNotification(data);
    }
}

/**
 * Event handler for on('contactPresenceChanged').
 * Will show an HTML5 notification to indicate that the chat status has changed.
 */
export function handleChatStateNotification (contact) {
    if (areDesktopNotificationsEnabled() && api.settings.get('show_chat_state_notifications')) {
        showChatStateNotification(contact);
    }
}

function showContactRequestNotification (contact) {
    const n = new Notification(contact.getDisplayName(), {
        body: __('wants to be your contact'),
        lang: _converse.locale,
        icon: api.settings.get('notification_icon')
    });
    setTimeout(() => n.close(), 5000);
}

export function handleContactRequestNotification (contact) {
    if (areDesktopNotificationsEnabled(true)) {
        showContactRequestNotification(contact);
    }
}

export function requestPermission () {
    if (supports_html5_notification && !['denied', 'granted'].includes(Notification.permission)) {
        // Ask user to enable HTML5 notifications
        Notification.requestPermission();
    }
}
