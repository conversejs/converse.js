// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// Copyright (c) 2019, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
/**
 * @module converse-headlines-view
 */
import "converse-chatview";
import converse from "@converse/headless/converse-core";
import tpl_chatbox from "templates/chatbox.html";


converse.plugins.add('converse-headlines-view', {
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
    dependencies: ["converse-headlines", "converse-chatview"],


    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;


        _converse.HeadlinesBoxView = _converse.ChatBoxView.extend({
            className: 'chatbox headlines',

            events: {
                'click .close-chatbox-button': 'close',
                'click .toggle-chatbox-button': 'minimize',
                'keypress textarea.chat-textarea': 'onKeyDown'
            },

            initialize () {
                this.initDebounced();

                this.model.disable_mam = true; // Don't do MAM queries for this box
                this.listenTo(this.model.messages, 'add', this.onMessageAdded);
                this.listenTo(this.model, 'show', this.show);
                this.listenTo(this.model, 'destroy', this.hide);
                this.listenTo(this.model, 'change:minimized', this.onMinimizedChanged);

                this.render().insertHeading()
                this.updateAfterMessagesFetched();
                this.insertIntoDOM().hide();
                /**
                 * Triggered once the {@link _converse.HeadlinesBoxView} has been initialized
                 * @event _converse#headlinesBoxViewInitialized
                 * @type { _converse.HeadlinesBoxView }
                 * @example _converse.api.listen.on('headlinesBoxViewInitialized', view => { ... });
                 */
                _converse.api.trigger('headlinesBoxViewInitialized', this);
            },

            render () {
                this.el.setAttribute('id', this.model.get('box_id'))
                this.el.innerHTML = tpl_chatbox(
                    Object.assign(this.model.toJSON(), {
                            info_close: '',
                            label_personal_message: '',
                            show_send_button: false,
                            show_toolbar: false,
                            unread_msgs: ''
                        }
                    ));
                this.content = this.el.querySelector('.chat-content');
                return this;
            },

            // Override to avoid the methods in converse-chatview.js
            'renderMessageForm': function renderMessageForm () {},
            'afterShown': function afterShown () {}
        });


        _converse.api.listen.on('chatBoxViewsInitialized', () => {
            const views = _converse.chatboxviews;
            _converse.chatboxes.on('add', item => {
                if (!views.get(item.get('id')) && item.get('type') === _converse.HEADLINES_TYPE) {
                    views.add(item.get('id'), new _converse.HeadlinesBoxView({model: item}));
                }
            });
        });
    }
});
