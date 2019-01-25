// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2013-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

import "@converse/headless/converse-vcard";
import "converse-modal";
import _FormData from "formdata-polyfill";
import bootstrap from "bootstrap.native";
import converse from "@converse/headless/converse-core";
import tpl_chat_status_modal from "templates/chat_status_modal.html";
import tpl_client_info_modal from "templates/client_info_modal.html";
import tpl_profile_modal from "templates/profile_modal.html";
import tpl_profile_view from "templates/profile_view.html";
import tpl_status_option from "templates/status_option.html";


const { Strophe, Backbone, Promise, utils, _, moment } = converse.env;
const u = converse.env.utils;


converse.plugins.add('converse-profile', {

    dependencies: ["converse-modal", "converse-vcard", "converse-chatboxviews"],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this,
              { __ } = _converse;


        _converse.ProfileModal = _converse.BootstrapModal.extend({
            events: {
                'change input[type="file"': "updateFilePreview",
                'click .change-avatar': "openFileSelection",
                'submit .profile-form': 'onFormSubmitted'
            },

            initialize () {
                this.model.on('change', this.render, this);
                _converse.BootstrapModal.prototype.initialize.apply(this, arguments);
                _converse.emit('profileModalInitialized', this.model);
            },

            toHTML () {
                return tpl_profile_modal(_.extend(
                    this.model.toJSON(),
                    this.model.vcard.toJSON(), {
                    '_': _,
                    '__': __,
                    '_converse': _converse,
                    'alt_avatar': __('Your avatar image'),
                    'heading_profile': __('Your Profile'),
                    'label_close': __('Close'),
                    'label_email': __('Email'),
                    'label_fullname': __('Full Name'),
                    'label_jid': __('XMPP Address (JID)'),
                    'label_nickname': __('Nickname'),
                    'label_role': __('Role'),
                    'label_role_help': __('Use commas to separate multiple roles. Your roles are shown next to your name on your chat messages.'),
                    'label_url': __('URL'),
                    'utils': u,
                    'view': this
                }));
            },

            afterRender () {
                this.tabs = _.map(this.el.querySelectorAll('.nav-item'), (tab) => new bootstrap.Tab(tab));
            },

            openFileSelection (ev) {
                ev.preventDefault();
                this.el.querySelector('input[type="file"]').click();
            },

            updateFilePreview (ev) {
                const file = ev.target.files[0],
                      reader = new FileReader();
                reader.onloadend = () => {
                    this.el.querySelector('.avatar').setAttribute('src', reader.result);
                };
                reader.readAsDataURL(file);
            },

            setVCard (data) {
                _converse.api.vcard.set(_converse.bare_jid, data)
                .then(() => _converse.api.vcard.update(this.model.vcard, true))
                .catch((err) => {
                    _converse.log(err, Strophe.LogLevel.FATAL);
                    _converse.api.alert.show(
                        Strophe.LogLevel.ERROR,
                        __('Error'),
                        [__("Sorry, an error happened while trying to save your profile data."),
                        __("You can check your browser's developer console for any error output.")]
                    )
                });
                this.modal.hide();
            },

            onFormSubmitted (ev) {
                ev.preventDefault();
                const reader = new FileReader(),
                      form_data = new FormData(ev.target),
                      image_file = form_data.get('image');

                const data = {
                    'fn': form_data.get('fn'),
                    'nickname': form_data.get('nickname'),
                    'role': form_data.get('role'),
                    'email': form_data.get('email'),
                    'url': form_data.get('url'),
                };
                if (!image_file.size) {
                    _.extend(data, {
                        'image': this.model.vcard.get('image'),
                        'image_type': this.model.vcard.get('image_type')
                    });
                    this.setVCard(data);
                } else {
                    reader.onloadend = () => {
                        _.extend(data, {
                            'image': btoa(reader.result),
                            'image_type': image_file.type
                        });
                        this.setVCard(data);
                    };
                    reader.readAsBinaryString(image_file);
                }
            }
        });


        _converse.ChatStatusModal = _converse.BootstrapModal.extend({
            events: {
                "submit form#set-xmpp-status": "onFormSubmitted",
                "click .clear-input": "clearStatusMessage"
            },

            toHTML () {
                return tpl_chat_status_modal(
                    _.extend(
                        this.model.toJSON(),
                        this.model.vcard.toJSON(), {
                        'label_away': __('Away'),
                        'label_close': __('Close'),
                        'label_busy': __('Busy'),
                        'label_cancel': __('Cancel'),
                        'label_custom_status': __('Custom status'),
                        'label_offline': __('Offline'),
                        'label_online': __('Online'),
                        'label_save': __('Save'),
                        'label_xa': __('Away for long'),
                        'modal_title': __('Change chat status'),
                        'placeholder_status_message': __('Personal status message')
                    }));
            },

            afterRender () {
                this.el.addEventListener('shown.bs.modal', () => {
                    this.el.querySelector('input[name="status_message"]').focus();
                }, false);
            },

            clearStatusMessage (ev) {
                if (ev && ev.preventDefault) {
                    ev.preventDefault();
                    u.hideElement(this.el.querySelector('.clear-input'));
                }
                const roster_filter = this.el.querySelector('input[name="status_message"]');
                roster_filter.value = '';
            },

            onFormSubmitted (ev) {
                ev.preventDefault();
                const data = new FormData(ev.target);
                this.model.save({
                    'status_message': data.get('status_message'),
                    'status': data.get('chat_status')
                });
                this.modal.hide();
            }
        });

        _converse.ClientInfoModal = _converse.BootstrapModal.extend({

            toHTML () {
                return tpl_client_info_modal(
                    _.extend(
                        this.model.toJSON(),
                        this.model.vcard.toJSON(), {
                            '__': __,
                            'modal_title': __('About'),
                            'version_name': _converse.VERSION_NAME,
                            'first_subtitle': __( '%1$s Open Source %2$s XMPP chat client brought to you by %3$s Opkode %2$s',
                                '<a target="_blank" rel="nofollow" href="https://conversejs.org">',
                                '</a>',
                                '<a target="_blank" rel="nofollow" href="https://opkode.com">'
                            ),
                            'second_subtitle': __('%1$s Translate %2$s it into your own language',
                                '<a target="_blank" rel="nofollow" href="https://hosted.weblate.org/projects/conversejs/#languages">',
                                '</a>'
                            )
                        }
                    )
                );
            }
        });

        _converse.XMPPStatusView = _converse.VDOMViewWithAvatar.extend({
            tagName: "div",
            events: {
                "click a.show-profile": "showProfileModal",
                "click a.change-status": "showStatusChangeModal",
                "click .show-client-info": "showClientInfoModal",
                "click .logout": "logOut"
            },

            initialize () {
                this.model.on("change", this.render, this);
                this.model.vcard.on("change", this.render, this);
            },

            toHTML () {
                const chat_status = this.model.get('status') || 'offline';
                return tpl_profile_view(_.extend(
                    this.model.toJSON(),
                    this.model.vcard.toJSON(), {
                    '__': __,
                    'fullname': this.model.vcard.get('fullname') || _converse.bare_jid,
                    'status_message': this.model.get('status_message') ||
                                        __("I am %1$s", this.getPrettyStatus(chat_status)),
                    'chat_status': chat_status,
                    '_converse': _converse,
                    'title_change_settings': __('Change settings'),
                    'title_change_status': __('Click to change your chat status'),
                    'title_log_out': __('Log out'),
                    'info_details': __('Show details about this chat client'),
                    'title_your_profile': __('Your profile')
                }));
            },

            afterRender () {
                this.renderAvatar();
            },

            showProfileModal (ev) {
                if (_.isUndefined(this.profile_modal)) {
                    this.profile_modal = new _converse.ProfileModal({model: this.model});
                }
                this.profile_modal.show(ev);
            },

            showStatusChangeModal (ev) {
                if (_.isUndefined(this.status_modal)) {
                    this.status_modal = new _converse.ChatStatusModal({model: this.model});
                }
                this.status_modal.show(ev);
            },

            showClientInfoModal(ev) {
                if (_.isUndefined(this.client_info_modal)) {
                    this.client_info_modal = new _converse.ClientInfoModal({model: this.model});
                }
                this.client_info_modal.show(ev);
            },

            logOut (ev) {
                ev.preventDefault();
                const result = confirm(__("Are you sure you want to log out?"));
                if (result === true) {
                    _converse.logOut();
                }
            },

            getPrettyStatus (stat) {
                if (stat === 'chat') {
                    return __('online');
                } else if (stat === 'dnd') {
                    return __('busy');
                } else if (stat === 'xa') {
                    return __('away for long');
                } else if (stat === 'away') {
                    return __('away');
                } else if (stat === 'offline') {
                    return __('offline');
                } else {
                    return __(stat) || __('online');
                }
            }
        });
    }
});

