import { CustomElement } from 'shared/components/element.js';
import { api, _converse } from '@converse/headless/core';
import { html } from 'lit';
import { __ } from 'i18n';


class BlockedUsersProfile extends CustomElement {

    async unblockContact (jid) {
        const result = await api.confirm(__("Are you sure you want to unblock this contact?"));
        if (result) {
            const unbl_result = await api.blocking.unblock([jid]);
            if (unbl_result) this.requestUpdate();
        }
    }

    initialize () {
        this.listenTo(_converse.blocking._blocked, 'change', () => this.requestUpdate() );
    }

    render () { // eslint-disable-line class-methods-use-this
        const i18n_unblock = __('Unblock');
        // TODO: Displaying the JID bare like this is probably wrong. It should probably be escaped
        // sanitized, or canonicalized or something before display. The same goes for all such
        // displays in this commit.
        return html`<ul>
            ${Array.from(api.blocking.blocklist()).map(
                jid => html`<li><p>${jid}</p><button type="button" class="btn btn-success" @click=${() => this.unblockContact(jid)}>${ i18n_unblock }</button></li>`
            )}
        </ul>`
    }
}

api.elements.define("converse-blockedusers-profile", BlockedUsersProfile);
