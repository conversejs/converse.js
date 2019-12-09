// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//

import "converse-chatview";
import "converse-profile";
import "converse-rosterview";
import converse from "@converse/headless/converse-core";
import sizzle from "sizzle";
import tpl_form_checkbox from "templates/form_checkbox.html";
import tpl_form_input from "templates/form_input.html";
import tpl_form_textarea from "templates/form_textarea.html";
import tpl_service_admin_chat from "templates/service_administration_chat.html";
import tpl_service_admin_option from "templates/service_administration_option.html";
import tpl_service_admin_selector from "templates/service_administration_selector.html";

const { $iq, Backbone, Strophe } = converse.env;
const u = converse.env.utils;

converse.plugins.add('converse-service-administration', {

    /* Plugin dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin.
     *
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found. By default it's
     * false, which means these plugins are only loaded opportunistically.
     *
     * NB: These plugins need to have already been loaded via require.js.
     */
    dependencies: ["converse-chatboxes", "converse-rosterview", "converse-chatview"],

    initialize () {
        const { _converse } = this,
            { __ } = _converse;

        _converse.SERVICE_ADMIN_TYPE = 'service-administration';

        _converse.ServiceAdministration = Backbone.Model.extend({
            async discoverSupport () {
                const supported = await _converse.api.disco.supports(Strophe.NS.COMMANDS, _converse.bare_jid);
                if (supported) {
                    const stanza = $iq({
                        'from': _converse.connection.jid,
                        'id': 'test-supported-commands',
                        'to': _converse.domain,
                        'type': 'get'
                    }).c('query', {
                        xmlns: Strophe.NS.DISCO_ITEMS,
                        node: 'announce'
                    }).up();

                    _converse.connection.sendIQ(stanza, result => {
                        const commands = sizzle('item[node^="http://jabber.org/protocol/admin"]', result);
                        _converse.serviceAdminCommands = new _converse.ServiceAdminCommandCollection();
                        commands.forEach(command => {
                            const command_description = command.getAttribute('name');
                            const command_node = command.getAttribute('node');
                            const command_name = command_node.split('#').pop();
                            _converse.serviceAdminCommands.add(new _converse.ServiceAdminCommandItem({
                                command_node: command_node,
                                description: command_description,
                                command_name: command_name
                            }));
                        });
                        this.renderControlboxElement();
                    });
                }
            },

            renderControlboxElement () {
                _converse.serviceAdministrationCommandView = new _converse.ServiceAdminCommandView({collection: _converse.serviceAdminCommands});
                const groupchat_element = _converse.chatboxviews.get('controlbox').el.querySelector('#chatrooms');
                if (groupchat_element !== null) {
                    groupchat_element.insertAdjacentElement('beforebegin', _converse.serviceAdministrationCommandView.render());
                }
            }
        });

        _converse.ServiceAdminCommandItem = Backbone.Model.extend({});

        _converse.ServiceAdminCommandItemView = Backbone.NativeView.extend({
            tagName: 'div',
            className: 'list-item controlbox-padded d-flex flex-row',
            events: {
                'click': 'openServiceAdminChat'
            },
            stanza: 'server_response',

            render () {
                this.el.innerHTML = tpl_service_admin_option({
                    'name': this.model.get('command_name'),
                    'service_admin_name': this.model.get('command_name')
                });
                return this.el;
            },

            openServiceAdminChat () {
                const stanza = $iq({
                    'from': _converse.connection.jid,
                    'id': this.model.attributes.command_name + '-1',
                    'to': _converse.domain,
                    'type': 'set',
                    'xml:lang': _converse.locale
                }).c('command', {
                    xmlns: Strophe.NS.COMMANDS,
                    action: 'execute',
                    node: this.model.attributes.command_node
                }).up();

                _converse.connection.sendIQ(stanza, result => {
                    this.server_response = result;
                    const session_id = sizzle('command', this.server_response).pop().getAttribute('sessionid');
                    const title = sizzle('title', this.server_response).pop();
                    const fields = sizzle('field', this.server_response);
                    const form_type_value = sizzle('field[var="FORM_TYPE"] > value', this.server_response).pop().innerHTML;

                    const field_array = [];
                    fields.forEach(field => {
                        const field_attrs = this.getAttributesFromField(field);
                        field_array.push(field_attrs);
                    });

                    const attributes = {
                        'id': this.model.get('command_name'),
                        'jid': _converse.domain,
                        'type': _converse.SERVICE_ADMIN_TYPE,
                        'from': _converse.domain,
                        'fields': field_array,
                        'form_type_value': form_type_value,
                        'name': this.model.get('name'),
                        'node': this.model.get('command_node'),
                        'stanza_id': this.model.get('name'),
                        'header_text': title.innerHTML,
                        'send_button_text': __('send'),
                        'placeholder_text': title.innerHTML,
                        'session_id': session_id
                    };

                    const existing_chatbox = _converse.chatboxes.get(this.model.get('command_name'));
                    if (existing_chatbox) {
                        existing_chatbox.set(attributes);
                        existing_chatbox.maybeShow(true);
                    } else {
                        const chatbox = new _converse.ServiceAdminBox(attributes);

                        _converse.chatboxes.add(chatbox);
                        chatbox.maybeShow(true);
                    }
                }, error => {
                    _converse.log(error, Strophe.LogLevel.ERROR);
                });
            },

            getAttributesFromField (field) {
                const attribute_names = field.getAttributeNames();
                const obj = {};
                attribute_names.forEach(name => {
                    obj[name] = field.getAttribute(name);
                });
                obj["value"] = this.getValueOfFieldElement(field);
                obj["required"] = field.getElementsByTagName('required').length !== 0;
                return obj;
            },

            getValueOfFieldElement (field) {
                const values = sizzle('value', field);
                let string_value = '';
                values.forEach(value => {
                    string_value = string_value + value.innerHTML + '\n';
                });
                return string_value.substring(0, string_value.length - 1); // return string without last line-break
            },
        });

        _converse.ServiceAdminCommandCollection = Backbone.Collection.extend ({
            model: _converse.ServiceAdminCommandItem,
        });

        _converse.ServiceAdminCommandView = Backbone.NativeView.extend({
            tagName: 'div',
            className: 'controlbox-section',
            id: 'service-admin-panel',
            collection: _converse.ServiceAdminCommandCollection,
            events: {
                'click a.service-admin-selector': 'toggleAdminOptions'
            },

            render () {
                this.el.innerHTML = tpl_service_admin_selector({
                    'title': __('Choose the Service-admin Function'),
                    'label': __('Announcement')
                });

                const service_admin_menu = this.el.querySelector('.service-admin-menu');
                this.collection.forEach(command => {
                    const itemView = new _converse.ServiceAdminCommandItemView({ model: command });
                    service_admin_menu.insertAdjacentElement('beforeend', itemView.render());
                });
                return this.el;
            },

            toggleAdminOptions (ev) {
                ev.preventDefault();
                u.slideToggleElement(this.el.querySelector(".service-admin-menu"));

                // toggle caret on List-Item
                const admin_list_caret = this.el.querySelector('.service-admin-selector-caret');
                if (admin_list_caret.classList.contains('fa-caret-right')) {
                    admin_list_caret.classList.remove('fa-caret-right');
                    admin_list_caret.classList.add('fa-caret-down');
                } else {
                    admin_list_caret.classList.remove('fa-caret-down');
                    admin_list_caret.classList.add('fa-caret-right');
                }
            }
        });

        _converse.ServiceAdminBox = _converse.ChatBox.extend({
            defaults () {
                return {
                    'bookmarked': false,
                    'box_id': 'service-administration',
                    'hidden': ['mobile', 'fullscreen'].includes(_converse.view_mode),
                    'message_type': 'service-administration',
                    'num_unread': 0,
                    'time_opened': this.get('time_opened') || (new Date()).getTime(),
                    'type': _converse.SERVICE_ADMIN_TYPE,
                    'url': '/test/' // ERROR: the url property is still missing, when save is called ...
                };
            }
        });

        _converse.ServiceAdminBoxView = _converse.ChatBoxView.extend({
            className: 'chatbox',
            id: 'service-administration',
            events: {
                'click .send-button': 'sendMessageToServer',
                'click .chatbox-btn': 'close'
            },

            initialize () {
                _converse.api.trigger('chatBoxInitialized', this);
                this.listenTo(this.model, 'destroy', this.hide);
                this.listenTo(this.model, 'hide', this.hide);
                this.listenTo(this.model, 'show', this.show);
                this.listenTo(this.model, 'change:closed', this.ensureClosedState);

                this.render();
            },

            render () {
                this.el.innerHTML = tpl_service_admin_chat({
                    'service_admin_header': this.model.attributes.header_text,
                    'info_close': __('Close'),
                    'send_button_text': this.model.attributes.send_button_text,
                    'placeholder_text': this.model.attributes.placeholder_text,
                });

                this.createGuiElementsByFieldType();
                this.insertSendButton();

                const converse_html = _converse.chatboxviews.el.querySelector('#controlbox');
                converse_html.insertAdjacentElement('afterend', this.el);

                return this.el;
            },

            createGuiElementsByFieldType () {
                this.model.attributes.fields.forEach(field => {
                    const type = field['type'];
                    switch (type) {
                        case 'hidden': break;
                        case 'text-single': this.renderTextSingleField(field); break;
                        case 'text-multi': this.renderTextMultiField(field); break;
                        case 'boolean': this.renderBooleanField(field); break;
                        default: break;
                    }
                });
            },

            renderTextSingleField (field) {
                const element = tpl_form_input({
                    'type': field['type'],
                    'label': field['label'],
                    'id': field['label'],
                    'name': field['var'],
                    'value': field['value'],
                    'autocomplete': false,
                    'placeholder': ''
                });
                const chat_body = this.el.querySelector('.chat-body');
                chat_body.insertAdjacentHTML('beforeend', element);
            },

            renderTextMultiField (field) {
                const element = tpl_form_textarea({
                    'label': field['label'],
                    'name': field['var'],
                    'value': field['value']
                });

                const chat_body = this.el.querySelector('.chat-body');
                chat_body.insertAdjacentHTML('beforeend', element);

                const text_area = sizzle('textarea[name="' + field['var'] + '"]', chat_body).pop();
                text_area.classList.add('form-control');
            },

            renderBooleanField (field) {
                const element = tpl_form_checkbox({
                    'id': field['var'],
                    'name': field['var'],
                    'label': field['label'],
                    'checked': field['value'],
                    'required': field["required"]
                });

                const chat_body = this.el.querySelector('.chat-body');
                chat_body.insertAdjacentHTML('beforeend', element);
            },

            insertSendButton () {
                const button = '<input type="button" class="send-button" value="send"/>';
                const chat_body = this.el.querySelector('.chat-body');
                chat_body.insertAdjacentHTML('beforeend', button);
            },

            show () {
                this.render();
                _converse.api.trigger('beforeShowingChatView', this);
                this.el.classList.remove('hidden');
            },

            hide () {
                this.el.classList.add('hidden');
                _converse.api.trigger('chatBoxClosed', this);
                return this;
            },

            close (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                // ERROR there is still a problem here, that the following line causes an infinite loop.
                // Since this function wasn't called in the tests lately I'm not sure how to fix this.
                this.model.close();
                this.remove();

                _converse.api.trigger('chatBoxClosed', this);
                return this;
            },

            sendMessageToServer (ev) {
                ev.preventDefault();

                const stanza = $iq({
                    'from': _converse.connection.jid,
                    'to': _converse.domain,
                    'id': this.model.attributes.stanza_id,
                    'type': 'set',
                    'xml:lang': _converse.locale
                }).c('command', {
                    xmlns: Strophe.NS.COMMANDS,
                    node: this.model.attributes.node,
                    sessionid: this.model.attributes.session_id
                }).c('x', {
                    xmlns: 'jabber:x:data',
                    type: 'submit'
                }).c('field', {
                    type: 'hidden',
                    var: 'FORM_TYPE'
                }).c('value').t(this.model.attributes.form_type_value).up().up();

                this.model.attributes.fields.forEach(field => {
                    const element = this.el.querySelector('[name="' + field['var'] + '"]');
                    if (element && element.value !== '') {
                        let value;
                        if (element.type === 'checkbox') {
                            value = element.checked;
                        } else {
                            value = this.addSenderJidToMessage(element.value, field);
                        }

                        stanza.c('field', {
                            var: field['var']
                        }).c('value').t(value).up().up();
                    }
                });

                _converse.connection.sendIQ(stanza, () => {
                    alert(__("The command was executed successfully."));
                }, error => {
                    const error_text = sizzle('error > text', error).pop().innerHTML;
                    alert(__("The command was NOT executed successfully for the following reason: " + error_text));
                });
            },

            addSenderJidToMessage (message, field) {
                if (field['var'] === 'subject' ||
                    (!this.model.attributes.node.includes('motd') &&
                    !this.model.attributes.node.includes('announce')))
                {
                    return message;
                }
                const SEND_FROM_SUBSTRING = __("-- sent from ");
                if (message.includes(SEND_FROM_SUBSTRING)) {
                    message = message.substring(0, message.indexOf(SEND_FROM_SUBSTRING));
                }
                message = message.trim();

                const attachment = SEND_FROM_SUBSTRING + _converse.jid.split('/')[0];
                return message + " " + attachment;
            }
        });

        _converse.api.listen.on('rosterViewInitialized', () => {
            _converse.serviceAdmin = new _converse.ServiceAdministration();
            _converse.serviceAdmin.discoverSupport();
        });

        _converse.api.listen.on('chatBoxViewsInitialized', () => {
            const views = _converse.chatboxviews;
            _converse.chatboxes.on('add', item => {
                if (!views.get(item.get('id')) && item.get('type') === _converse.SERVICE_ADMIN_TYPE) {
                    views.add(item.get('id'), new _converse.ServiceAdminBoxView({model: item}));
                }
            });
        });
    }
});
