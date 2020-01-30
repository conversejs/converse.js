/**
 * @module converse-headlines-view
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "converse-chatview";
import { View } from 'skeletor.js/src/view.js';
import { __ } from '@converse/headless/i18n';
import converse from "@converse/headless/converse-core";
import tpl_chatbox from "templates/chatbox.html";
import tpl_headline_list from "templates/headline_list.html";
import tpl_headline_panel from "templates/headline_panel.html";


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

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        //
        // New functions which don't exist yet can also be added.

        ControlBoxView: {
            renderControlBoxPane () {
                this.__super__.renderControlBoxPane.apply(this, arguments);
                this.renderHeadlinePanel();
            },
        },
    },




    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;


        const viewWithHeadlinePanel = {
            renderHeadlinePanel () {
                if (this.headlinepanel && u.isInDOM(this.headlinepanel.el)) {
                    return this.headlinepanel;
                }
                this.headlinepanel = new _converse.HeadlinePanel();
                this.el.querySelector('.controlbox-pane').insertAdjacentElement(
                    'beforeEnd', this.headlinepanel.render().el);

                return this.headlinepanel;
            },

            getHeadlinePanel () {
                if (this.headlinepanel && u.isInDOM(this.headlinepanel.el)) {
                    return this.headlinepanel;
                } else {
                    return this.renderHeadlinePanel();
                }
            }
        }

        if (_converse.ControlBoxView) {
            Object.assign(_converse.ControlBoxView.prototype, viewWithHeadlinePanel);
        }


        /**
         * View which renders headlines section of the control box.
         * @class
         * @namespace _converse.HeadlinePanel
         * @memberOf _converse
         */
        _converse.HeadlinePanel = View.extend({
            tagName: 'div',
            className: 'controlbox-section',
            id: 'headline',

            events: {
                'click .open-headline': 'openHeadline'
            },

            openHeadline (ev) {
                ev.preventDefault();
                const jid = ev.target.getAttribute('data-headline-jid');
                const chat = _converse.chatboxes.get(jid);
                chat.maybeShow(true);
            },

            render () {
                this.el.innerHTML = tpl_headline_panel({
                    'heading_headline': __('Announcements')
                });
                return this;
            }
        });


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


        async function renderHeadlineList (removedBox=null) {
            const controlboxview = _converse.chatboxviews.get('controlbox');
            if (controlboxview !== undefined) {
                const headlineboxes = await _converse.api.headlines.get();
                const el = controlboxview.el.querySelector('.list-container--headline');
                const headline_list = tpl_headline_list({
                    headlineboxes,
                    'open_title': __('Click to open this server message'),
                });
                el && (el.outerHTML = headline_list);
            }
        }


        _converse.api.listen.on('chatBoxViewsInitialized', () => {
            const views = _converse.chatboxviews;
            _converse.chatboxes.on('add', item => {
                if (!views.get(item.get('id')) && item.get('type') === _converse.HEADLINES_TYPE) {
                    views.add(item.get('id'), new _converse.HeadlinesBoxView({model: item}));
                    renderHeadlineList();
                }
            });

            _converse.chatboxes.on('remove', () => renderHeadlineList());
        });
    }
});
