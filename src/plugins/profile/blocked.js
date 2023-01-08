import { CustomElement } from 'shared/components/element.js';
import { api, _converse } from '@converse/headless/core';
import { html } from 'lit';


class BlockedUsersProfile extends CustomElement {

    initialize () {
        this.listenTo(_converse.blocked, 'change', () => this.requestUpdate() );
    }

    render () { // eslint-disable-line class-methods-use-this
        // TODO: Displaying the JID bare like this is probably wrong. It should probably be escaped
        // sanitized, or canonicalized or something before display. The same goes for all such
        // displays in this commit.
        const { blocked } = _converse;
        return html`<ul>
            ${Array.from(blocked.get('set')).map(
                jid => html`<li><p>${jid}</p><button @click=${() => api.unblockUser(jid)}>Unblock</button></li>`
            )}
        </ul>`
    }
}

api.elements.define("converse-blockedusers-profile", BlockedUsersProfile);
