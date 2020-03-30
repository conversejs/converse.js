/**
 * @module converse-profile
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "@converse/headless/converse-status";
import "@converse/headless/converse-vcard";
import "converse-modal";
import { BootstrapModal } from "./converse-modal.js";
import bootstrap from "bootstrap.native";
import converse from "@converse/headless/converse-core";
import log from "@converse/headless/log";
import sizzle from 'sizzle';
import tpl_chat_status_modal from "templates/chat_status_modal";
import tpl_client_info_modal from "templates/client_info_modal";
import tpl_profile from "templates/profile.js";
import tpl_profile_modal from "templates/profile_modal";

const u = converse.env.utils;


converse.plugins.add('converse-profile', {

    dependencies: ["converse-status", "converse-modal", "converse-vcard", "converse-chatboxviews"],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this,
              { __ } = _converse;

        _converse.api.settings.update({
            'show_client_info': true
        });


        _converse.ProfileModal = BootstrapModal.extend({
            id: "user-profile-modal",
            events: {
                'change input[type="file"': "updateFilePreview",
                'click .change-avatar': "openFileSelection",
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
                _converse.api.trigger('profileModalInitialized', this.model);
            },

            toHTML () {
                return tpl_profile_modal(Object.assign(
                    this.model.toJSON(),
                    this.model.vcard.toJSON(), {
                    '_converse': _converse,
                    'utils': u,
                    'view': this
                }));
            },

            afterRender () {
                this.tabs = sizzle('.nav-item .nav-link', this.el).map(e => new bootstrap.Tab(e));
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
                    log.fatal(err);
                    _converse.api.show('error', __('Error'), [
                        __("Sorry, an error happened while trying to save your profile data."),
                        __("You can check your browser's developer console for any error output.")
                    ]);
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

        _converse.ClientInfoModal = BootstrapModal.extend({
            id: "converse-client-info-modal",

            toHTML () {
                return tpl_client_info_modal(
                    Object.assign(
                        this.model.toJSON(),
                        this.model.vcard.toJSON(),
                        { 'version_name': _converse.VERSION_NAME }
                    )
                );
            }
        });

        _converse.XMPPStatusView = _converse.ViewWithAvatar.extend({
            tagName: "div",
            events: {
                "click a.show-profile": "showProfileModal",
                "click a.change-status": "showStatusChangeModal",
                "click .show-client-info": "showClientInfoModal",
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
                    _converse,
                    chat_status,
                    'fullname': this.model.vcard.get('fullname') || _converse.bare_jid,
                    'status_message': this.model.get('status_message') ||
                                        __("I am %1$s", this.getPrettyStatus(chat_status))
                }));
            },

            afterRender () {
                this.renderAvatar();
            },

            showProfileModal (ev) {
                if (this.profile_modal === undefined) {
                    this.profile_modal = new _converse.ProfileModal({model: this.model});
                }
                this.profile_modal.show(ev);
            },

            showStatusChangeModal (ev) {
                if (this.status_modal === undefined) {
                    this.status_modal = new _converse.ChatStatusModal({model: this.model});
                }
                this.status_modal.show(ev);
            },

            showClientInfoModal(ev) {
                if (this.client_info_modal === undefined) {
                    this.client_info_modal = new _converse.ClientInfoModal({model: this.model});
                }
                this.client_info_modal.show(ev);
            },

            logOut (ev) {
                ev.preventDefault();
                const result = confirm(__("Are you sure you want to log out?"));
                if (result === true) {
                    _converse.api.user.logout();
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
        _converse.api.listen.on('controlBoxPaneInitialized', async view => {
            await _converse.api.waitUntil('VCardsInitialized');
            _converse.xmppstatusview = new _converse.XMPPStatusView({'model': _converse.xmppstatus});
            view.el.insertAdjacentElement('afterBegin', _converse.xmppstatusview.render().el);
        });
    }
});
