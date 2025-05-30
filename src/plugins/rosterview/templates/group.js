import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { _converse, api, u } from '@converse/headless';
import 'shared/components/icons.js';
import { __ } from 'i18n';
import { toggleGroup } from '../utils.js';

const { isUniView } = u;

/**
 * @param {import('@converse/headless/types/plugins/roster/contact').default} contact
 */
function renderContact(contact) {
    const jid = contact.get('jid');
    const extra_classes = [];
    if (isUniView()) {
        const chatbox = _converse.state.chatboxes.get(jid);
        if (chatbox && !chatbox.get('hidden')) {
            extra_classes.push('open');
        }
    }
    const ask = contact.get('ask');
    const requesting = contact.get('requesting');
    const subscription = contact.get('subscription');
    if (ask === 'subscribe' || subscription === 'from') {
        /* ask === 'subscribe'
         *      Means we have asked to subscribe to them.
         *
         * subscription === 'from'
         *      They are subscribed to us, but not vice versa.
         *      We assume that there is a pending subscription
         *      from us to them (otherwise we're in a state not
         *      supported by converse.js).
         *
         *  So in both cases the user is a "pending" contact.
         */
        extra_classes.push('pending-xmpp-contact');
    } else if (requesting === true) {
        extra_classes.push('requesting-xmpp-contact');
    } else if (subscription === 'both' || subscription === 'to' || u.isSameBareJID(jid, api.connection.get().jid)) {
        extra_classes.push('current-xmpp-contact');
        extra_classes.push(subscription);
        extra_classes.push(contact.getStatus());
    }
    return html` <li
        class="list-item d-flex controlbox-padded ${extra_classes.join(' ')}"
        data-status="${contact.getStatus()}"
    >
        <converse-roster-contact .model=${contact}></converse-roster-contact>
    </li>`;
}

export default (o) => {
    const i18n_title = __('Click to hide these contacts');
    const collapsed = _converse.state.roster.state.get('collapsed_groups');
    return html`<div class="roster-group" data-group="${o.name}">
        <a
            href="#"
            class="list-toggle group-toggle controlbox-padded"
            title="${i18n_title}"
            @click=${(ev) => toggleGroup(ev, o.name)}
        >
            <converse-icon
                color="var(--chat-color)"
                size="1em"
                class="fa ${collapsed.includes(o.name) ? 'fa-caret-right' : 'fa-caret-down'}"
            ></converse-icon>
            ${o.name}&nbsp;
            ${o.contacts[0].get('requesting')
                ? html` <converse-icon color="var(--chat-color)" size="1.2em" class="fa fa-bell-alt"></converse-icon>`
                : ``}
        </a>
        <ul
            class="items-list roster-group-contacts ${collapsed.includes(o.name) ? 'collapsed' : ''}"
            data-group="${o.name}"
        >
            ${repeat(o.contacts, (c) => c.get('jid'), renderContact)}
        </ul>
    </div>`;
};
