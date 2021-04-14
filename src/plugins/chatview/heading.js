import UserDetailsModal from 'modals/user-details.js';
import debounce from 'lodash/debounce';
import tpl_chatbox_head from './templates/chat-head.js';
import { ElementView } from '@converse/skeletor/src/element.js';
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";
import { getHeadingDropdownItem, getHeadingStandaloneButton } from 'plugins/chatview/utils.js';
import { render } from 'lit';


export default class ChatHeading extends ElementView {

    async render () {
        const tpl = await this.generateHeadingTemplate();
        render(tpl, this);
    }

    connectedCallback () {
        super.connectedCallback();
        this.model = _converse.chatboxes.get(this.getAttribute('jid'));
        this.debouncedRender = debounce(this.render, 100);
        this.listenTo(this.model, 'vcard:change', this.debouncedRender);
        if (this.model.contact) {
            this.listenTo(this.model.contact, 'destroy', this.debouncedRender);
        }
        this.model.rosterContactAdded?.then(() => {
            this.listenTo(this.model.contact, 'change:nickname', this.debouncedRender);
            this.debouncedRender();
        });
        this.render();
    }

    showUserDetailsModal (ev) {
        ev.preventDefault();
        api.modal.show(UserDetailsModal, { model: this.model }, ev);
    }

    close () {
        _converse.chatboxviews.get(this.getAttribute('jid'))?.close();
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

    async generateHeadingTemplate () {
        const vcard = this.model?.vcard;
        const vcard_json = vcard ? vcard.toJSON() : {};
        const i18n_profile = __("The User's Profile Image");
        const avatar_data = Object.assign(
            {
                'alt_text': i18n_profile,
                'extra_classes': '',
                'height': 40,
                'width': 40
            },
            vcard_json
        );
        const heading_btns = await this.getHeadingButtons();
        const standalone_btns = heading_btns.filter(b => b.standalone);
        const dropdown_btns = heading_btns.filter(b => !b.standalone);
        return tpl_chatbox_head(
            Object.assign(this.model.toJSON(), {
                avatar_data,
                'display_name': this.model.getDisplayName(),
                'dropdown_btns': dropdown_btns.map(b => getHeadingDropdownItem(b)),
                'showUserDetailsModal': ev => this.showUserDetailsModal(ev),
                'standalone_btns': standalone_btns.map(b => getHeadingStandaloneButton(b))
            })
        );
    }


}

api.elements.define('converse-chat-heading', ChatHeading);
