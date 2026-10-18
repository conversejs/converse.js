import { html } from 'lit';
import { api, converse, constants, u } from '@converse/headless';
import { __ } from 'i18n';

const { Strophe } = converse.env;
const { callDuration, reasonText } = u.jingle;
const { PRIVATE_CHAT_TYPE } = constants;

/**
 * The peer's name for the call UI. The roster contact resolves asynchronously,
 * so we fall back to the nickname and then the JID node while it's still null.
 * @param {import('@converse/headless').Call} call
 * @returns {string}
 */
export function getCallName(call) {
    const jid = call.get('jid');
    return call.contact?.getDisplayName?.() || call.get('nickname') || Strophe.getNodeFromJid(jid) || jid;
}

/**
 * The summary line shown in the call card once it's over.
 * @param {import('@converse/headless').Call} call
 * @returns {string}
 */
export function endedSummary(call) {
    const duration = callDuration(call);
    if (duration) return __('Call ended · %1$s', duration);
    return call.get('missed') ? __('Missed call') : reasonText(call.get('ended_reason'));
}

/**
 * `getToolbarButtons` handler: an audio call button in 1:1 chats.
 * @param {import('shared/chat/toolbar').ChatToolbar} toolbar_el
 * @param {import('lit').TemplateResult[]} buttons
 * @returns {import('lit').TemplateResult[]}
 */
export function getCallButton(toolbar_el, buttons) {
    const { model } = toolbar_el;
    if (model.get('type') !== PRIVATE_CHAT_TYPE || !api.settings.get('visible_toolbar_buttons')?.call) {
        return buttons;
    }
    /** @param {MouseEvent} ev */
    const onClick = (ev) => {
        ev.preventDefault();
        api.calls.dial(model.get('jid'));
    };
    buttons.push(html`
        <button type="button" class="btn start-call" title="${__('Start an audio call')}" @click=${onClick}>
            <converse-icon color="var(--chat-color)" class="fa fa-phone" size="1em"></converse-icon>
        </button>`);
    return buttons;
}
