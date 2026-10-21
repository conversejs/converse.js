import { _converse, api, constants, converse } from '@converse/headless';
import { __ } from 'i18n';

const { Strophe } = converse.env;
const { CHATROOMS_TYPE, PRIVATE_CHAT_TYPE } = constants;

const LIVE_REGION_ID = 'converse-live-region';

/**
 * @returns {HTMLElement}
 */
function getLiveRegion() {
    let region = document.getElementById(LIVE_REGION_ID);
    if (!region) {
        region = document.createElement('div');
        region.id = LIVE_REGION_ID;
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('aria-atomic', 'true');
        // Visually hidden, but still read out by screen readers
        Object.assign(region.style, {
            position: 'absolute',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
        });
        document.body.appendChild(region);
    }
    return region;
}

export function removeLiveRegion() {
    document.getElementById(LIVE_REGION_ID)?.remove();
}

/**
 * Reads out the passed in text to screen reader users.
 * @param {string} text
 */
export function announce(text) {
    if (!api.settings.get('enable_screen_reader_announcements')) return;

    const region = getLiveRegion();
    // Clear first, so that repeating the same text is announced again
    region.textContent = '';
    setTimeout(() => (region.textContent = text), 100);
}

/**
 * Announces a message which the notifications plugin deemed worth notifying
 * the user about. Messages in a visible chat are skipped, since its message
 * history is already a live region.
 * @param {{ attrs: import('@converse/headless/types/plugins/muc/types').MUCMessageAttributes }} data
 */
export function announceMessage(data) {
    const { attrs } = data;
    if (!['chat', 'groupchat'].includes(attrs.type)) return;

    const body = attrs.is_encrypted ? attrs.plaintext : attrs.body;
    if (!body) return;

    const jid = attrs.from_muc ?? Strophe.getBareJidFromJid(attrs.from);
    const chatbox = _converse.state.chatboxes.get(jid);
    if (chatbox && !chatbox.get('hidden') && !document.hidden) return;

    const name = chatbox?.getDisplayName() ?? jid;
    if (attrs.type === 'groupchat') {
        announce(__('%1$s in %2$s: %3$s', attrs.nick, name, body));
    } else {
        announce(__('%1$s: %2$s', name, body));
    }
}

/**
 * @returns {import('@converse/headless').ChatBox|import('@converse/headless').MUC|undefined}
 */
export function getVisibleChat() {
    return _converse.state.chatboxes?.find(
        (m) => [CHATROOMS_TYPE, PRIVATE_CHAT_TYPE].includes(m.get('type')) && !m.get('hidden'),
    );
}

/**
 * @param {import('@converse/headless').ChatBox|import('@converse/headless').MUC} chatbox
 * @returns {boolean}
 */
export function hasUnreadMessages(chatbox) {
    return chatbox.get('num_unread') > 0 || chatbox.get('num_unread_general') > 0;
}
