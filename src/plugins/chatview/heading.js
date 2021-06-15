import UserDetailsModal from 'modals/user-details.js';
import tpl_chatbox_head from './templates/chat-head.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";

import './styles//chat-head.scss';


export default class ChatHeading extends CustomElement {

    connectedCallback () {
        super.connectedCallback();
        this.initialize();
    }

    initialize () {
        this.model = _converse.chatboxes.get(this.getAttribute('jid'));
        this.listenTo(this.model, 'change:status', this.requestUpdate);
        this.listenTo(this.model, 'vcard:change', this.requestUpdate);
        if (this.model.contact) {
            this.listenTo(this.model.contact, 'destroy', this.requestUpdate);
        }
        this.model.rosterContactAdded?.then(() => {
            this.listenTo(this.model.contact, 'change:nickname', this.requestUpdate);
            this.requestUpdate();
        });
    }

    render () {
        return tpl_chatbox_head(Object.assign(this.model.toJSON(), {
            'heading_buttons_promise': this.getHeadingButtons(),
            'model': this.model,
            'showUserDetailsModal': ev => this.showUserDetailsModal(ev),
        }));
    }

    showUserDetailsModal (ev) {
        ev.preventDefault();
        api.modal.show(UserDetailsModal, { model: this.model }, ev);
    }

    close (ev) {
        ev.preventDefault();
        this.model.close();
    }

    /**
     * Returns a list of objects which represent buttons for the chat's header.
     * @async
     * @emits _converse#getHeadingButtons
     */
    getHeadingButtons () {
        const buttons = [
            {
                'a_class': 'show-user-details-modal',
                'handler': ev => this.showUserDetailsModal(ev),
                'i18n_text': __('Details'),
                'i18n_title': __('See more information about this person'),
                'icon_class': 'fa-id-card',
                'name': 'details',
                'standalone': api.settings.get('view_mode') === 'overlayed'
            }
        ];
        if (!api.settings.get('singleton')) {
            buttons.push({
                'a_class': 'close-chatbox-button',
                'handler': ev => this.close(ev),
                'i18n_text': __('Close'),
                'i18n_title': __('Close and end this conversation'),
                'icon_class': 'fa-times',
                'name': 'close',
                'standalone': api.settings.get('view_mode') === 'overlayed'
            });
        }
        /**
         * *Hook* which allows plugins to add more buttons to a chat's heading.
         * @event _converse#getHeadingButtons
         * @example
         *  api.listen.on('getHeadingButtons', (view, buttons) => {
         *      buttons.push({
         *          'i18n_title': __('Foo'),
         *          'i18n_text': __('Foo Bar'),
         *          'handler': ev => alert('Foo!'),
         *          'a_class': 'toggle-foo',
         *          'icon_class': 'fa-foo',
         *          'name': 'foo'
         *      });
         *      return buttons;
         *  });
         */
        const chatview = _converse.chatboxviews.get(this.getAttribute('jid'));
        if (chatview) {
            return _converse.api.hook('getHeadingButtons', chatview, buttons);
        } else {
            return buttons; // Happens during tests
        }
    }
}

api.elements.define('converse-chat-heading', ChatHeading);
