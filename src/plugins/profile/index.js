/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import '../modal/index.js';
import './modals/chat-status.js';
import './modals/profile.js';
import './modals/user-settings.js';
import './statusview.js';
import '@converse/headless/plugins/status';
import '@converse/headless/plugins/vcard';
import { api, converse } from '@converse/headless/core';

converse.plugins.add('converse-profile', {
    dependencies: [
        'converse-status',
        'converse-modal',
        'converse-vcard',
        'converse-chatboxviews',
        'converse-adhoc-views',
    ],

    initialize () {
        api.settings.extend({ 'show_client_info': true });
    },
});

class BlockedUsersProfile extends CustomElement {

    async initialize () {
        this.listenTo(_converse.blocked, 'change', () => this.requestUpdate() );
    }

    render () {
        // TODO: Displaying the JID bare like this is probably wrong. It should probably be escaped
        // sanitized, or canonicalized or something before display. The same goes for all such
        // displays in this commit.
        return ((el) => { return html`<ul>
                ${Array.from(_converse
                             .blocked
                             .get('set'))
                             .map(jid => html`<li><p>${jid}</p>
                                                   <button @click=${el.unblock(jid)}>Unblock</button>
                                              </li>
                                             `
                                 )
                 }
            </ul>`
        })(this);
    }

    unblock (member) {
        return ev => {
            api.unblockUser([member]);
        }
    }
}

api.elements.define("converse-blockedusers-profile", BlockedUsersProfile);

