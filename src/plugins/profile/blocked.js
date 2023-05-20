import { CustomElement } from 'shared/components/element.js';
import { api, _converse } from '@converse/headless/core';
import { html } from 'lit';
import { __ } from 'i18n';


class BlockedUsersProfile extends CustomElement {

    initialize () {
        this.listenTo(_converse.blocked, 'change', () => this.requestUpdate() );
    }

    render () { // eslint-disable-line class-methods-use-this
        const i18n_unblock = __('Unblock');
        // TODO: Displaying the JID bare like this is probably wrong. It should probably be escaped
        // sanitized, or canonicalized or something before display. The same goes for all such
        // displays in this commit.
        const { blocked } = _converse;
        return html`<ul>
            ${Array.from(blocked.get('set')).map(
                jid => html`<li><p>${jid}</p><button type="button" class="btn btn-success" @click=${() => api.unblockUser(jid)}>${ i18n_unblock }</button></li>`
            )}
        </ul>`
    }
}

api.elements.define("converse-blockedusers-profile", BlockedUsersProfile);
