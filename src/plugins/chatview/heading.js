import 'shared/modals/user-details.js';
import tplChatboxHead from './templates/chat-head.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless";

import './styles/chat-head.scss';

const { Strophe } = converse.env;


export default class ChatHeading extends CustomElement {

    constructor () {
        super();
        this.jid = null;
    }

    static get properties () {
        return {
            'jid': { type: String },
        }
    }

    initialize () {
        const { chatboxes } = _converse.state;
        this.model = chatboxes.get(this.jid);
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
        return tplChatboxHead(this);
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
     * @emits _converse#getHeadingButtons
     * @returns {Promise<Array.<import('./types').HeadingButtonAttributes>>}
     */
    async getHeadingButtons () {
        const buttons = [
            /** @type {import('./types').HeadingButtonAttributes} */
            {
                a_class: 'show-user-details-modal',
                handler: /** @param {Event} ev */(ev) => this.showUserDetailsModal(ev),
                i18n_text: __('Details'),
                i18n_title: __('See more information about this person'),
                icon_class: 'fa-id-card',
                name: 'details',
                standalone: api.settings.get('view_mode') === 'overlayed'
            },
        ];

        if (await api.disco.supports(Strophe.NS.BLOCKING, _converse.session.get('domain'))) {
            const blocklist = await api.blocklist.get();
            if (blocklist.get(this.model.get('jid'))) {
                buttons.push({
                    a_class: 'unblock-user',
                    handler: /** @param {Event} ev */ async (ev) => {
                        ev.preventDefault();
                        const result = await api.confirm(
                            __('Unblock user'),
                            [__('Are you sure you want to unblock this user?')]
                        );
                        if (result) {
                            api.blocklist.remove(this.model.get('jid'));
                        }
                    },
                    i18n_text: __('Unblock this user'),
                    i18n_title: __('Allow this user to send you messages'),
                    icon_class: 'fa-check',
                    name: 'unblock',
                    standalone: false
                });
            } else {
                buttons.push({
                    a_class: 'block-user',
                    handler: /** @param {Event} ev */ async (ev) => {
                        ev.preventDefault();
                        const result = await api.confirm(
                            __('Block user'),
                            [__('Are you sure you want to block this user?')]
                        );
                        if (result) {
                            const jid = this.model.get('jid');
                            api.blocklist.add(jid);
                            api.contacts.remove(jid, true);
                            this.model.close();
                        }
                    },
                    i18n_text: __('Block this user'),
                    i18n_title: __('Prevent this user from sending you any further messages'),
                    icon_class: 'fa-trash',
                    name: 'block',
                    standalone: false
                });
            }
        }

        if (!api.settings.get('singleton')) {
            buttons.push({
                a_class: 'close-chatbox-button',
                handler: /** @param {Event} ev */(ev) => this.close(ev),
                i18n_text: __('Close'),
                i18n_title: __('Close and end this conversation'),
                icon_class: 'fa-times',
                name: 'close',
                standalone: api.settings.get('view_mode') === 'overlayed'
            });
        }
        const { chatboxviews } = _converse.state;
        const el = chatboxviews.get(this.getAttribute('jid'));
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
             * @param { Array.<import('./types').HeadingButtonAttributes> }
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
