import 'shared/components/icons.js';
import { __ } from 'i18n';
import { _converse, converse } from "@converse/headless/core";
import { html } from "lit";
import { isUniView } from '@converse/headless/utils/core.js';
import { toggleGroup } from '../utils.js';

const { u } = converse.env;


function renderContact (contact) {
    const jid = contact.get('jid');
    const extra_classes = [];
    if (isUniView()) {
        const chatbox = _converse.chatboxes.get(jid);
        if (chatbox && !chatbox.get('hidden')) {
            extra_classes.push('open');
        }
    }
    const ask = contact.get('ask');
    const requesting  = contact.get('requesting');
    const subscription = contact.get('subscription');
    if ((ask === 'subscribe') || (subscription === 'from')) {
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
    } else if (subscription === 'both' || subscription === 'to' || u.isSameBareJID(jid, _converse.connection.jid)) {
        extra_classes.push('current-xmpp-contact');
        extra_classes.push(subscription);
        extra_classes.push(contact.presence.get('show'));
    }
    return html`
        <li class="list-item d-flex controlbox-padded ${extra_classes.join(' ')}" data-status="${contact.presence.get('show')}">
            <converse-roster-contact .model=${contact}></converse-roster-contact>
        </li>`;
}


export default  (o) => {
    const i18n_title = __('Click to hide these contacts');
    const collapsed = _converse.roster.state.get('collapsed_groups');
    return html`
        <div class="roster-group" data-group="${o.name}">
            <a href="#" class="list-toggle group-toggle controlbox-padded" title="${i18n_title}" @click=${ev => toggleGroup(ev, o.name)}>
                <converse-icon color="var(--chat-head-color-dark)" size="1em" class="fa ${ (collapsed.includes(o.name)) ? 'fa-caret-right' : 'fa-caret-down' }"></converse-icon> ${o.name}
            </a>
            <ul class="items-list roster-group-contacts ${ (collapsed.includes(o.name)) ? 'collapsed' : '' }" data-group="${o.name}">
                ${ o.contacts.map(renderContact) }
            </ul>
        </div>`;
}
