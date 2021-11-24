import log from "@converse/headless/log";
import tpl_pending_contact from "./templates/pending_contact.js";
import tpl_requesting_contact from "./templates/requesting_contact.js";
import tpl_roster_item from "./templates/roster_item.js";
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";

const u = converse.env.utils;


export default class RosterContact extends CustomElement {

    static get properties () {
        return {
            model: { type: Object }
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.listenTo(this.model, "change", this.requestUpdate);
        this.listenTo(this.model, "highlight", this.requestUpdate);
        this.listenTo(this.model, 'vcard:change', this.requestUpdate);
    }

    render () {
        const ask = this.model.get('ask');
        const requesting  = this.model.get('requesting');
        const subscription = this.model.get('subscription');
        const jid = this.model.get('jid');

        if ((ask === 'subscribe') || (subscription === 'from')) {
            /* ask === 'subscribe'
             *      Means we have asked to subscribe to them.
             *
             * subscription === 'from'
             *      They are subscribed to use, but not vice versa.
             *      We assume that there is a pending subscription
             *      from us to them (otherwise we're in a state not
             *      supported by converse.js).
             *
             *  So in both cases the user is a "pending" contact.
             */
            const display_name = this.model.getDisplayName();
            return tpl_pending_contact(Object.assign(
                this.model.toJSON(), {
                    display_name,
                    'openChat': ev => this.openChat(ev),
                    'removeContact':  ev => this.removeContact(ev)
                }));

        } else if (requesting === true) {
            const display_name = this.model.getDisplayName();
            return tpl_requesting_contact(
                Object.assign(this.model.toJSON(), {
                    display_name,
                    'openChat': ev => this.openChat(ev),
                    'acceptRequest': ev => this.acceptRequest(ev),
                    'declineRequest': ev => this.declineRequest(ev),
                    'desc_accept': __("Click to accept the contact request from %1$s", display_name),
                    'desc_decline': __("Click to decline the contact request from %1$s", display_name),
                    'allow_chat_pending_contacts': api.settings.get('allow_chat_pending_contacts')
                })
            );
        } else if (subscription === 'both' || subscription === 'to' || u.isSameBareJID(jid, _converse.connection.jid)) {
            return this.renderRosterItem(this.model);
        }
    }

    renderRosterItem (item) {
        return tpl_roster_item(this, item);
    }

    openChat (ev) {
        ev?.preventDefault?.();
        this.model.openChat();
    }

    removeContact (ev) {
        ev?.preventDefault?.();
        if (!api.settings.get('allow_contact_removal')) { return; }
        if (!confirm(__("Are you sure you want to remove this contact?"))) { return; }

        try {
            this.model.removeFromRoster();
            if (this.model.collection) {
                // The model might have already been removed as
                // result of a roster push.
                this.model.destroy();
            }
        } catch (e) {
            log.error(e);
            api.alert('error', __('Error'),
                [__('Sorry, there was an error while trying to remove %1$s as a contact.', this.model.getDisplayName())]
            );
        }
    }

    async acceptRequest (ev) {
        ev?.preventDefault?.();

        await _converse.roster.sendContactAddIQ(
            this.model.get('jid'),
            this.model.getFullname(),
            []
        );
        this.model.authorize().subscribe();
    }

    declineRequest (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        const result = confirm(__("Are you sure you want to decline this contact request?"));
        if (result === true) {
            this.model.unauthorize().destroy();
        }
        return this;
    }
}

api.elements.define('converse-roster-contact', RosterContact);
