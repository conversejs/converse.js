import { Model } from '@converse/skeletor';
import { _converse, converse, api, log } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplRequestingContact from './templates/requesting_contact.js';
import tplRosterItem from './templates/roster_item.js';
import tplUnsavedContact from './templates/unsaved_contact.js';
import { __ } from 'i18n';
import { blockContact, removeContact } from './utils.js';

const { Strophe } = converse.env;

export default class RosterContact extends CustomElement {
    static get properties() {
        return {
            model: { type: Object },
        };
    }

    constructor() {
        super();
        this.model = null;
    }

    initialize() {
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        this.listenTo(this.model, 'highlight', () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:add', () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:change', () => this.requestUpdate());
        this.listenTo(this.model, 'presenceChanged', () => this.requestUpdate());
    }

    render() {
        if (this.model.get('requesting') === true) {
            return tplRequestingContact(this);
        } else if (this.model.get('subscription') === 'none') {
            return tplUnsavedContact(this);
        } else {
            return tplRosterItem(this);
        }
    }

    /**
     * @param {MouseEvent} ev
     */
    openChat(ev) {
        ev?.preventDefault?.();
        api.chats.open(this.model.get('jid'), this.model.attributes, true);
    }

    /**
     * @param {MouseEvent} ev
     */
    addContact(ev) {
        ev?.preventDefault?.();
        api.modal.show('converse-add-contact-modal', { 'model': new Model() }, ev);
    }

    /**
     * @param {MouseEvent} ev
     */
    async removeContact(ev) {
        ev?.preventDefault?.();
        // TODO: ask user whether they want to unauthorize the contact's
        // presence request as well.
        await removeContact(this.model);
    }

    /**
     * @param {MouseEvent} ev
     */
    async blockContact(ev) {
        ev?.preventDefault?.();
        await blockContact(this.model);
    }

    /**
     * @param {MouseEvent} ev
     */
    async acceptRequest(ev) {
        ev?.preventDefault?.();

        await _converse.state.roster.sendContactAddIQ({
            jid: this.model.get('jid'),
            name: this.model.getFullname(),
            groups: [],
        });
        this.model.authorize().subscribe();
    }

    /**
     * @param {MouseEvent} ev
     */
    async declineRequest(ev) {
        ev?.preventDefault?.();
        const domain = _converse.session.get('domain');
        const blocking_supported = await api.disco.supports(Strophe.NS.BLOCKING, domain);

        const result = await api.confirm(
            __('Decline contact request'),
            [__('Are you sure you want to decline this contact request?')],
            blocking_supported
                ? [
                      {
                          label: __('Block this user from sending you further messages'),
                          name: 'block',
                          type: 'checkbox',
                      },
                  ]
                : []
        );

        if (result) {
            const chat = await api.chats.get(this.model.get('jid'));
            chat?.close();
            this.model.unauthorize();

            if (blocking_supported && Array.isArray(result)) {
                const should_block = result.find((i) => i.name === 'block')?.value === 'on';
                if (should_block) {
                    api.blocklist.add(this.model.get('jid'));
                }
            }

            this.model.destroy();
        }
        return this;
    }
}

api.elements.define('converse-roster-contact', RosterContact);
