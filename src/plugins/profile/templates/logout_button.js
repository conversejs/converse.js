import { html } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';

/**
 * @param {import('../modals/profile').default} el
 */
export default (el) => {
    const i18n_logout = __('Log out');
    return html`<button type="button" @click="${(ev) => el.logOut(ev)}" class="btn btn-danger">
        ${api.settings.get('allow_logout')
            ? html`<converse-icon class="fas fa-sign-out-alt" color="var(--background-color)" size="1em"></converse-icon
                  >&nbsp;${i18n_logout} `
            : ''}
    </button>`;
};
