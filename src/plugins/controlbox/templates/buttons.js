import { html } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import { logOut } from '../utils.js';

function tplSignout() {
    const i18n_logout = __('Log out');
    return html`<a class="controlbox-heading__btn logout align-self-center" title="${i18n_logout}" @click=${logOut}>
        <converse-icon class="fa fa-sign-out-alt" size="1em"></converse-icon>
    </a>`;
}

/**
 * @param {import('../buttons').default} el
 */
function tplUserSettingsButton(el) {
    const i18n_details = __('Show details about this chat client');
    return html`<a
        class="controlbox-heading__btn show-client-info align-self-center"
        title="${i18n_details}"
        @click=${el.showUserSettingsModal}
    >
        <converse-icon class="fa fa-cog" size="1em"></converse-icon>
    </a>`;
}

/**
 * @param {import('../buttons').default} el
 */
function tplCloseButton(el) {
    return html` <a class="controlbox-heading__btn close align-self-center" @click=${(ev) => el.closeControlBox(ev)}>
        <converse-icon class="fa fa-times" size="1em"></converse-icon>
    </a>`;
}

/**
 * @param {import('../buttons').default} el
 */
export default (el) => {
    const is_connected = el.model.get('connected');
    const show_settings_button = api.settings.get('show_client_info') || api.settings.get('allow_adhoc_commands');
    return html` <div class="btn-toolbar g-0">
        ${is_connected && show_settings_button ? tplUserSettingsButton(el) : ''}
        ${is_connected && api.settings.get('allow_logout') ? tplSignout() : ''}
        ${api.settings.get('sticky_controlbox') ? '' : tplCloseButton(el)}
    </div>`;
};
