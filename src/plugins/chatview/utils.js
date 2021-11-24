import { __ } from 'i18n';
import { _converse } from "@converse/headless/core";
import { html } from 'lit';


export function clearHistory (jid) {
    if (_converse.router.history.getFragment() === `converse/chat?jid=${jid}`) {
        _converse.router.navigate('');
    }
}

export async function getHeadingDropdownItem (promise_or_data) {
    const data = await promise_or_data;
    return data ? html`
        <a href="#" class="dropdown-item ${data.a_class}" @click=${data.handler} title="${data.i18n_title}">
            <converse-icon size="1em" color="var(--text-color-lighten-15-percent)" class="fa ${data.icon_class}"></converse-icon>
            ${data.i18n_text}
        </a>
    ` : '';
}

export async function getHeadingStandaloneButton (promise_or_data) {
    const data = await promise_or_data;
    return html`
        <a
            href="#"
            class="chatbox-btn ${data.a_class} fa ${data.icon_class}"
            @click=${data.handler}
            title="${data.i18n_title}"
        ></a>
    `;
}

export async function clearMessages (chat) {
    const result = confirm(__('Are you sure you want to clear the messages from this conversation?'));
    if (result === true) {
        await chat.clearMessages();
    }
}


export function parseMessageForCommands (chat, text) {
    const match = text.replace(/^\s*/, '').match(/^\/(.*)\s*$/);
    if (match) {
        if (match[1] === 'clear') {
            clearMessages(chat);
            return true;
        } else if (match[1] === 'close') {
            _converse.chatboxviews.get(chat.get('jid'))?.close();
            return true;
        } else if (match[1] === 'help') {
            chat.set({ 'show_help_messages': false }, { 'silent': true });
            chat.set({ 'show_help_messages': true });
            return true;
        }
    }
}

export function resetElementHeight (ev) {
    if (ev.target.value) {
        const height = ev.target.scrollHeight + 'px';
        if (ev.target.style.height != height) {
            ev.target.style.height = 'auto';
            ev.target.style.height = height;
        }
    } else {
        ev.target.style = '';
    }
}
