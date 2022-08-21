import 'shared/modals/user-details.js';
import tpl_chatbox_head from './templates/chat-head.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";

import './styles/chat-head.scss';


export default class ChatHeading extends CustomElement {

    static get properties () {
        return {
            'jid': { type: String },
        }
    }

    initialize () {
        this.model = _converse.chatboxes.get(this.jid);
        this.listenTo(this.model, 'change:status', () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:add', () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:change', () => this.requestUpdate());
        if (this.model.contact) {
            this.listenTo(this.model.contact, 'destroy', () => this.requestUpdate());
        }
        this.model.rosterContactAdded?.then(() => {
            this.listenTo(this.model.contact, 'change:nickname', () => this.requestUpdate());
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
        api.modal.show('converse-user-details-modal', { model: this.model }, ev);
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
            /**
             * @typedef { Object } HeadingButtonAttributes
             * An object representing a chat heading button
             * @property { Boolean } standalone
             *  True if shown on its own, false if it must be in the dropdown menu.
             * @property { Function } handler
             *  A handler function to be called when the button is clicked.
             * @property { String } a_class - HTML classes to show on the button
             * @property { String } i18n_text - The user-visiible name of the button
             * @property { String } i18n_title - The tooltip text for this button
             * @property { String } icon_class - What kind of CSS class to use for the icon
             * @property { String } name - The internal name of the button
             */
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
        const el = _converse.chatboxviews.get(this.getAttribute('jid'));
        if (el) {
            /**
             * *Hook* which allows plugins to add more buttons to a chat's heading.
             *
             * Note: This hook is fired for both 1 on 1 chats and groupchats.
             * If you only care about one, you need to add a check in your code.
             *
             * @event _converse#getHeadingButtons
             * @param { HTMLElement } el
             *      The `converse-chat` (or `converse-muc`) DOM element that represents the chat
             * @param { Array.<HeadingButtonAttributes> }
             *      An array of the existing buttons. New buttons may be added,
             *      and existing ones removed or modified.
             * @example
             *  api.listen.on('getHeadingButtons', (el, buttons) => {
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
            return _converse.api.hook('getHeadingButtons', el, buttons);
        } else {
            return buttons; // Happens during tests
        }
    }
}

api.elements.define('converse-chat-heading', ChatHeading);
