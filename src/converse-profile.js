// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define(["converse-core",
            "tpl!change_status_message",
            "tpl!chat_status",
            "tpl!choose_status",
            "tpl!status_option",
            "converse-vcard"
    ], factory);
}(this, function (
            converse,
            tpl_change_status_message,
            tpl_chat_status,
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

            _converse.XMPPStatusView = Backbone.NativeView.extend({
                el: "form#set-xmpp-status",
                events: {
                    "click a.choose-xmpp-status": "toggleOptions",
                    "click #fancy-xmpp-status-select a.change-xmpp-status-message": "renderStatusChangeForm",
                    "submit": "setStatusMessage",
                    "click .dropdown dd ul li a": "setStatus"
                },

                initialize () {
                    this.model.on("change:status", this.updateStatusUI, this);
                    this.model.on("change:status_message", this.updateStatusUI, this);
                    this.model.on("update-status-ui", this.updateStatusUI, this);
                },

                render () {
                    // Replace the default dropdown with something nicer
                    const select = this.el.querySelector('select#select-xmpp-status')
                    const chat_status = this.model.get('status') || 'offline';
                    this.el.innerHTML = tpl_choose_status();

                    this.el.querySelector('#fancy-xmpp-status-select')
                        .innerHTML = tpl_chat_status({
                            'status_message': this.model.get('status_message') ||
                                              __("I am %1$s", this.getPrettyStatus(chat_status)),
                            'chat_status': chat_status,
                            'desc_custom_status': __('Click here to write a custom status message'),
                            'desc_change_status': __('Click to change your chat status')
                        });

                    // iterate through all the <option> elements and add option values
                    const options_list = _.map(
                        select.querySelectorAll('option'),
                        function (el) {
                            return tpl_status_option({
                                'value': el.value,
                                'text': el.text
                            });
                        }
                    );
                    const options_target = this.el.querySelector("#target dd ul");
                    options_target.classList.add('collapsed');
                    options_target.innerHTML = options_list.join('');
                    return this;
                },

                toggleOptions (ev) {
                    ev.preventDefault();
                    utils.slideInAllElements(
                        document.querySelectorAll('#conversejs .contact-form-container')
                    );
                    utils.slideToggleElement(this.el.querySelector("#target dd ul"));
                },

                renderStatusChangeForm (ev) {
                    ev.preventDefault();
                    const xmppstatus = this.el.querySelector('.xmpp-status');
                    xmppstatus.parentNode.classList.add('no-border');
                    xmppstatus.outerHTML = tpl_change_status_message({
                        'status_message': _converse.xmppstatus.get('status_message') || '',
                        'label_custom_status': __('Custom status'),
                        'label_save': __('Save')
                    });
                    this.el.querySelector('.custom-xmpp-status').focus();
                },

                setStatusMessage (ev) {
                    ev.preventDefault();
                    this.model.setStatusMessage(ev.target.querySelector('input').value);
                },

                setStatus (ev) {
                    ev.preventDefault();
                    const value = ev.target.getAttribute('data-value');
                    if (value === 'logout') {
                        _converse.logOut();
                    } else {
                        this.model.setStatus(value);
                    }
                    utils.slideIn(this.el.querySelector("#target dd ul"));
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
                },

                updateStatusUI (model) {
                    const stat = model.get('status');
                    // For translators: the %1$s part gets replaced with the status
                    // Example, I am online
                    const status_message = model.get('status_message') || __("I am %1$s", this.getPrettyStatus(stat));
                    const fancy_select = this.el.querySelector('#fancy-xmpp-status-select');
                    fancy_select.classList.remove('no-border');
                    fancy_select.innerHTML = tpl_chat_status({
                        'chat_status': stat,
                        'status_message': status_message,
                        'desc_custom_status': __('Click here to write a custom status message'),
                        'desc_change_status': __('Click to change your chat status')
                    });
                }
            });
        }
    });
}));
