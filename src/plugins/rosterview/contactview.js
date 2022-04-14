import log from "@converse/headless/log.js";
import tpl_requesting_contact from "./templates/requesting_contact.js";
import tpl_roster_item from "./templates/roster_item.js";
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";


export default class RosterContact extends CustomElement {

    static get properties () {
        return {
            model: { type: Object }
        }
    }

    initialize () {
        this.listenTo(this.model, "change", () => this.requestUpdate());
        this.listenTo(this.model, "highlight", () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:add', () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:change', () => this.requestUpdate());
    }

    render () {
        if (this.model.get('requesting') === true) {
            const display_name = this.model.getDisplayName();
            return tpl_requesting_contact(
                Object.assign(this.model.toJSON(), {
                    display_name,
                    'openChat': ev => this.openChat(ev),
                    'acceptRequest': ev => this.acceptRequest(ev),
                    'declineRequest': ev => this.declineRequest(ev),
                    'desc_accept': __("Click to accept the contact request from %1$s", display_name),
                    'desc_decline': __("Click to decline the contact request from %1$s", display_name),
                })
            );
        } else {
            return tpl_roster_item(this, this.model);
        }
    }

    openChat (ev) {
        ev?.preventDefault?.();
        this.model.openChat();
    }

    async removeContact (ev) {
        ev?.preventDefault?.();
        if (!api.settings.get('allow_contact_removal')) { return; }

        const result = await api.confirm(__("Are you sure you want to remove this contact?"));
        if (!result)  return;

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

    async declineRequest (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        const result = await api.confirm(__("Are you sure you want to decline this contact request?"));
        if (result) {
            this.model.unauthorize().destroy();
        }
        return this;
    }
}

api.elements.define('converse-roster-contact', RosterContact);
