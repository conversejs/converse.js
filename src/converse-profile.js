/**
 * @module converse-profile
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "@converse/headless/converse-status";
import "@converse/headless/converse-vcard";
import "converse-modal";
import UserSettingsModal from "modals/user-settings";
import bootstrap from "bootstrap.native";
import log from "@converse/headless/log";
import sizzle from 'sizzle';
import tpl_chat_status_modal from "templates/chat_status_modal";
import tpl_profile from "templates/profile.js";
import tpl_profile_modal from "templates/profile_modal";
import { BootstrapModal } from "./converse-modal.js";
import { __ } from './i18n';
import { _converse, api, converse } from "@converse/headless/converse-core";

const u = converse.env.utils;


converse.plugins.add('converse-profile', {

    dependencies: ["converse-status", "converse-modal", "converse-vcard", "converse-chatboxviews"],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */

        api.settings.extend({
            'allow_adhoc_commands': true,
            'show_client_info': true
        });


        _converse.ProfileModal = BootstrapModal.extend({
            id: "user-profile-modal",
            events: {
                'submit .profile-form': 'onFormSubmitted'
            },

            initialize () {
                this.listenTo(this.model, 'change', this.render);
                BootstrapModal.prototype.initialize.apply(this, arguments);
                /**
                 * Triggered when the _converse.ProfileModal has been created and initialized.
                 * @event _converse#profileModalInitialized
                 * @type { _converse.XMPPStatus }
                 * @example _converse.api.listen.on('profileModalInitialized', status => { ... });
                 */
                api.trigger('profileModalInitialized', this.model);
            },

            toHTML () {
                return tpl_profile_modal(Object.assign(
                    this.model.toJSON(),
                    this.model.vcard.toJSON(),
                    this.getAvatarData(),
                    { 'view': this }
                ));
            },

            getAvatarData () {
                const image_type = this.model.vcard.get('image_type');
                const image_data = this.model.vcard.get('image');
                const image = "data:" + image_type + ";base64," + image_data;
                return {
                    'height': 128,
                    'width': 128,
                    image,
                };
            },

            afterRender () {
                this.tabs = sizzle('.nav-item .nav-link', this.el).map(e => new bootstrap.Tab(e));
            },

            async setVCard (data) {
                try {
                    await api.vcard.set(_converse.bare_jid, data);
                } catch (err) {
                    log.fatal(err);
                    this.alert([
                        __("Sorry, an error happened while trying to save your profile data."),
                        __("You can check your browser's developer console for any error output.")
                    ].join(" "));
                    return;
                }
                this.modal.hide();
            },

            onFormSubmitted (ev) {
                ev.preventDefault();
                const reader = new FileReader();
                const form_data = new FormData(ev.target);
                const image_file = form_data.get('image');
                const data = {
                    'fn': form_data.get('fn'),
                    'nickname': form_data.get('nickname'),
                    'role': form_data.get('role'),
                    'email': form_data.get('email'),
                    'url': form_data.get('url'),
                };
                if (!image_file.size) {
                    Object.assign(data, {
                        'image': this.model.vcard.get('image'),
                        'image_type': this.model.vcard.get('image_type')
                    });
                    this.setVCard(data);
                } else {
                    reader.onloadend = () => {
                        Object.assign(data, {
                            'image': btoa(reader.result),
                            'image_type': image_file.type
                        });
                        this.setVCard(data);
                    };
                    reader.readAsBinaryString(image_file);
                }
            }
        });


        _converse.ChatStatusModal = BootstrapModal.extend({
            id: "modal-status-change",
            events: {
                "submit form#set-xmpp-status": "onFormSubmitted",
                "click .clear-input": "clearStatusMessage"
            },

            toHTML () {
                return tpl_chat_status_modal(
                    Object.assign(
                        this.model.toJSON(),
                        this.model.vcard.toJSON(), {
                        'label_away': __('Away'),
                        'label_busy': __('Busy'),
                        'label_cancel': __('Cancel'),
                        'label_close': __('Close'),
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

        _converse.XMPPStatusView = _converse.ViewWithAvatar.extend({
            tagName: "div",
            events: {
                "click a.show-profile": "showProfileModal",
                "click a.change-status": "showStatusChangeModal",
                "click .logout": "logOut"
            },

            initialize () {
                this.listenTo(this.model, "change", this.render);
                this.listenTo(this.model.vcard, "change", this.render);
            },

            toHTML () {
                const chat_status = this.model.get('status') || 'offline';
                return tpl_profile(Object.assign(
                    this.model.toJSON(),
                    this.model.vcard.toJSON(), {
                    chat_status,
                    'fullname': this.model.vcard.get('fullname') || _converse.bare_jid,
                    "showUserSettingsModal": ev => this.showUserSettingsModal(ev),
                    'status_message': this.model.get('status_message') ||
                                        __("I am %1$s", this.getPrettyStatus(chat_status)),
                }));
            },

            afterRender () {
                this.renderAvatar();
            },

            showProfileModal (ev) {
                ev.preventDefault();
                if (this.profile_modal === undefined) {
                    this.profile_modal = new _converse.ProfileModal({model: this.model});
                }
                this.profile_modal.show(ev);
            },

            showStatusChangeModal (ev) {
                ev.preventDefault();
                if (this.status_modal === undefined) {
                    this.status_modal = new _converse.ChatStatusModal({model: this.model});
                }
                this.status_modal.show(ev);
            },

            showUserSettingsModal(ev) {
                ev.preventDefault();
                if (this.user_settings_modal === undefined) {
                    this.user_settings_modal = new UserSettingsModal({model: this.model, _converse});
                }
                this.user_settings_modal.show(ev);
            },

            logOut (ev) {
                ev.preventDefault();
                const result = confirm(__("Are you sure you want to log out?"));
                if (result === true) {
                    api.user.logout();
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


        /******************** Event Handlers ********************/
        api.listen.on('controlBoxPaneInitialized', async view => {
            await api.waitUntil('VCardsInitialized');
            _converse.xmppstatusview = new _converse.XMPPStatusView({'model': _converse.xmppstatus});
            view.el.insertAdjacentElement('afterBegin', _converse.xmppstatusview.render().el);
        });
    }
});
