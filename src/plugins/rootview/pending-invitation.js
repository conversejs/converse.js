import { html } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import { DEFAULT_ACTION, isHandledXMPPURI, parseXMPPURI } from 'shared/xmpp-uri.js';
import tplCopyableAddress from 'templates/copyable-address.js';
import { getPendingXMPPURI } from './protocol-handler.js';
import './styles/pending-invitation.scss';

/**
 * A few well-known XMPP apps, for someone without one who would rather
 * install an app than use the browser. Deliberately short: the link after
 * them leads to the full list.
 */
const APPS = [
    { name: 'Conversations', url: 'https://conversations.im/', platforms: 'Android' },
    { name: 'Monal', url: 'https://monal-im.org/', platforms: 'iOS, macOS' },
    { name: 'Gajim', url: 'https://gajim.org/', platforms: 'Windows, Linux' },
    { name: 'Dino', url: 'https://dino.im/', platforms: 'Linux' },
];
const MORE_APPS_URL = 'https://xmpp.org/software/';

function tplApps() {
    const i18n_no_app = __("Don't have an XMPP app yet? Try one of these:");
    const i18n_more = __('More apps');
    return html`<div class="pending-invitation__apps mt-3">
        <p class="mb-1">${i18n_no_app}</p>
        <ul class="list-inline mb-0">
            ${APPS.map(
                (a) =>
                    html`<li class="list-inline-item">
                        <a href="${a.url}" target="_blank" rel="noopener">${a.name}</a>
                        <span class="pending-invitation__platforms">(${a.platforms})</span>
                    </li>`,
            )}
            <li class="list-inline-item">
                <a href="${MORE_APPS_URL}" target="_blank" rel="noopener">${i18n_more}</a>
            </li>
        </ul>
    </div>`;
}

/**
 * Shown above the login and registration forms when the page was opened with
 * an invitation to chat with someone or to join a groupchat (a shareable link
 * or an `xmpp:` link), which is acted on once the visitor has logged in.
 *
 * Someone following a shareable link may not have an account yet, or may
 * rather use the XMPP app they already have, so it says what's waiting for
 * them and offers both. A link handed over by the browser's protocol handler
 * already chose this Converse as the app, so it only says what's waiting.
 */
export default class PendingInvitation extends CustomElement {
    constructor() {
        super();
        this.onHashChange = () => this.requestUpdate();
    }

    connectedCallback() {
        super.connectedCallback();
        // The pending URI changes with the hash, which the protocol handler's
        // own `hashchange` listener (registered first) has read by then.
        addEventListener('hashchange', this.onHashChange);
    }

    disconnectedCallback() {
        removeEventListener('hashchange', this.onHashChange);
        super.disconnectedCallback();
    }

    render() {
        const pending = getPendingXMPPURI();
        // A link the browser handed over isn't checked before it's held, and the
        // dispatcher would turn it down after login, so promise nothing for it.
        if (!pending || !isHandledXMPPURI(pending.uri)) return '';

        const { jid, action } = parseXMPPURI(pending.uri);
        const querytype = action ?? DEFAULT_ACTION;
        if (!['message', 'join'].includes(querytype)) return '';

        const is_room = querytype === 'join';
        const i18n_open_app = __('Open in your XMPP app');
        if (pending.from_handler) {
            const i18n_log_in = is_room ? __('Log in to join the groupchat') : __('Log in to chat with');
            return html`<div class="pending-invitation card mb-3">
                <div class="card-body text-center">
                    <p class="mb-1">${i18n_log_in}</p>
                    <p class="pending-invitation__jid fw-bold mb-0">${tplCopyableAddress(jid)}</p>
                </div>
            </div>`;
        }

        const i18n_invited = is_room ? __("You're invited to join the groupchat") : __("You're invited to chat with");
        const i18n_or_browser = __('Or log in below, or create an account, to continue here in your browser.');
        return html`<div class="pending-invitation card mb-3">
            <div class="card-body text-center">
                <p class="mb-1">${i18n_invited}</p>
                <p class="pending-invitation__jid fw-bold mb-3">${tplCopyableAddress(jid)}</p>
                <a class="btn btn-primary pending-invitation__open-app" href="${pending.uri}">${i18n_open_app}</a>
                ${tplApps()}
                <p class="pending-invitation__or-browser mt-3 mb-0">${i18n_or_browser}</p>
            </div>
        </div>`;
    }
}

api.elements.define('converse-pending-invitation', PendingInvitation);
