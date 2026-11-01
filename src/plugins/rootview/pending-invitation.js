import { html } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import { DEFAULT_ACTION, isHandledXMPPURI, parseXMPPURI } from 'shared/xmpp-uri.js';
import tplCopyableAddress from 'templates/copyable-address.js';
import { getPendingXMPPURI } from './protocol-handler.js';
import './styles/pending-invitation.scss';

const MORE_APPS_URL = 'https://xmpp.org/software/';

/**
 * What the User-Agent Client Hints platform or the user agent string names,
 * first match wins. ChromeOS runs both Android and Linux apps, so it's left
 * unknown, and Android user agents also mention Linux.
 * @type {Array<[RegExp, import('./types').Platform|null]>}
 */
const PLATFORM_PATTERNS = [
    [/CrOS|Chrome OS|Chromium OS/, null],
    [/Android/, 'Android'],
    [/iPhone|iPad|iPod|^iOS$/, 'iOS'],
    [/Mac/, 'macOS'],
    [/Win/, 'Windows'],
    [/Linux/, 'Linux'],
];

/**
 * The platform the visitor is on, as far as the browser lets on, or null when
 * it can't be told.
 * @returns {import('./types').Platform|null}
 */
function getPlatform() {
    // User-Agent Client Hints are Chromium only, and not in TypeScript's DOM types.
    const hint = /** @type {any} */ (navigator).userAgentData?.platform;
    const ua = hint || navigator.userAgent;
    const [, platform = null] = PLATFORM_PATTERNS.find(([re]) => re.test(ua)) ?? [];
    // iPadOS Safari presents itself as a Mac, but Macs have no touch screen.
    return platform === 'macOS' && navigator.maxTouchPoints > 1 ? 'iOS' : platform;
}

/**
 * The apps to suggest: the first one in the `shareable_link_apps` setting
 * for the visitor's platform, or all of them if there's none or the platform
 * is unknown.
 * @returns {{ apps: import('./types').XMPPApp[], for_platform: boolean }}
 */
function getSuggestedApps() {
    /** @type {import('./types').XMPPApp[]} */
    const apps = api.settings.get('shareable_link_apps') ?? [];
    const platform = getPlatform();
    const app = platform && apps.find((a) => a.platforms?.includes(platform));
    return app ? { apps: [app], for_platform: true } : { apps, for_platform: false };
}

/**
 * XMPP apps for someone without one who would rather install an app than use
 * the browser. The link after them leads to the full list.
 */
function tplApps() {
    const { apps, for_platform } = getSuggestedApps();
    if (!apps.length) return '';

    const i18n_no_app = for_platform
        ? __("Don't have an XMPP app yet? Try this one:")
        : __("Don't have an XMPP app yet? Try one of these:");
    const i18n_more = __('More apps');
    return html`<div class="pending-invitation__apps mt-3">
        <p class="mb-1">${i18n_no_app}</p>
        <ul class="list-inline mb-0">
            ${apps.map(
                (a) =>
                    html`<li class="list-inline-item">
                        <a href="${a.url}" target="_blank" rel="noopener">${a.name}</a>
                        ${
                            !for_platform && a.platforms?.length
                                ? html`<span class="pending-invitation__platforms">(${a.platforms.join(', ')})</span>`
                                : ''
                        }
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
