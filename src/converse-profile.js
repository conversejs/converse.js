// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define(["converse-core",
            "bootstrap.native",
            "tpl!chat_status_modal",
            "tpl!profile_view",
            "tpl!choose_status",
            "tpl!status_option",
            "converse-vcard"
    ], factory);
}(this, function (
            converse,
            bootstrap,
            tpl_chat_status_modal,
            tpl_profile_view,
            tpl_choose_status,
            tpl_status_option
        ) {
    "use strict";

    const { Strophe, Backbone, Promise, utils, _, moment } = converse.env;


    converse.plugins.add('converse-profile', {

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                  { __ } = _converse;


            _converse.ChatStatusModal = Backbone.VDOMView.extend({
                id: "modal-status-change",
                events: {
                    "submit.set-xmpp-status .logout": "onFormSubmitted"
                },

                initialize () {
                    this.render().insertIntoDOM();
                    this.modal = new bootstrap.Modal(this.el, {
                        backdrop: 'static', // we don't want to dismiss Modal when Modal or backdrop is the click event target
                        keyboard: true // we want to dismiss Modal on pressing Esc key
                    });
                },

                show () {
                    this.modal.show();
                },

                insertIntoDOM () {
                    const container_el = _converse.chatboxviews.el.querySelector('#converse-modals');
                    container_el.insertAdjacentElement('beforeEnd', this.el);
                },

                toHTML () {
                    return tpl_chat_status_modal(_.extend(this.model.toJSON(), {
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

                onFormSubmitted (ev) {
                    ev.preventDefault();
                    debugger;
                    this.model.save('status_message', ev.target.querySelector('input').value);
                }
            });

            _converse.XMPPStatusView = Backbone.VDOMView.extend({
                tagName: "div",
                events: {
                    "click a.change-status": this.status_modal.show.bind(this.status_modal),
                    "click .dropdown dd ul li a": "setStatus",
                    "click .logout": "logOut"
                },

                initialize () {
                    this.model.on("change", this.render, this);
                    this.status_modal = new _converse.ChatStatusModal({model: this.model});
                },

                toHTML () {
                    const chat_status = this.model.get('status') || 'offline';
                    return tpl_profile_view(_.extend(this.model.toJSON(), {
                        'fullname': this.model.get('fullname') || _converse.bare_jid,
                        'status_message': this.model.get('status_message') ||
                                            __("I am %1$s", this.getPrettyStatus(chat_status)),
                        'chat_status': chat_status,
                        'title_change_settings': __('Change settings'),
                        'title_change_status': __('Click to change your chat status'),
                        'title_log_out': __('Log out'),
                        'title_your_profile': __('Your profile')
                    }));
                },

                logOut (ev) {
                    ev.preventDefault();
                    const result = confirm(__("Are you sure you want to log out?"));
                    if (result === true) {
                        _converse.logOut();
                    }
                },

                setStatus (ev) {
                    ev.preventDefault();
                    const value = ev.target.getAttribute('data-value');
                    this.model.set('status', value);
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
}));
