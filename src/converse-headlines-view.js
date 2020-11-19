/**
 * @module converse-headlines-view
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "converse-chatview";
import tpl_chatbox from "templates/chatbox.js";
import tpl_headline_panel from "templates/headline_panel.js";
import { ChatBoxView } from "./converse-chatview";
import { View } from '@converse/skeletor/src/view.js';
import { __ } from './i18n';
import { _converse, api, converse } from "@converse/headless/converse-core";
import { render } from "lit-html";

const u = converse.env.utils;


const HeadlinesBoxView = ChatBoxView.extend({
    className: 'chatbox headlines hidden',

    events: {
        'click .close-chatbox-button': 'close',
        'click .toggle-chatbox-button': 'minimize',
        'keypress textarea.chat-textarea': 'onKeyDown'
    },

    async initialize () {
        this.initDebounced();

        this.model.disable_mam = true; // Don't do MAM queries for this box
        this.listenTo(this.model, 'change:hidden', m => m.get('hidden') ? this.hide() : this.show());
        this.listenTo(this.model, 'destroy', this.remove);
        this.listenTo(this.model, 'show', this.show);

        this.render();

        // Need to be registered after render has been called.
        this.listenTo(this.model.messages, 'add', this.onMessageAdded);
        this.listenTo(this.model.messages, 'remove', this.renderChatHistory);
        this.listenTo(this.model.messages, 'rendered', this.maybeScrollDown);
        this.listenTo(this.model.messages, 'reset', this.renderChatHistory);

        await this.model.messages.fetched;
        this.insertIntoDOM();
        this.model.maybeShow();
        this.scrollDown();
        /**
         * Triggered once the {@link _converse.HeadlinesBoxView} has been initialized
         * @event _converse#headlinesBoxViewInitialized
         * @type { _converse.HeadlinesBoxView }
         * @example _converse.api.listen.on('headlinesBoxViewInitialized', view => { ... });
         */
        api.trigger('headlinesBoxViewInitialized', this);
    },

    render () {
        this.el.setAttribute('id', this.model.get('box_id'))
        const result = tpl_chatbox(
            Object.assign(this.model.toJSON(), {
                    info_close: '',
                    label_personal_message: '',
                    show_send_button: false,
                    show_toolbar: false,
                    unread_msgs: ''
                }
            ));
        render(result, this.el);
        this.content = this.el.querySelector('.chat-content');
        this.msgs_container = this.el.querySelector('.chat-content__messages');
        this.renderChatContent();
        this.renderHeading();
        return this;
    },

    getNotifications () {
        // Override method in ChatBox. We don't show notifications for
        // headlines boxes.
        return [];
    },

    /**
     * Returns a list of objects which represent buttons for the headlines header.
     * @async
     * @emits _converse#getHeadingButtons
     * @private
     * @method _converse.HeadlinesBoxView#getHeadingButtons
     */
    getHeadingButtons () {
        const buttons = [];
        if (!api.settings.get("singleton")) {
            buttons.push({
                'a_class': 'close-chatbox-button',
                'handler': ev => this.close(ev),
                'i18n_text': __('Close'),
                'i18n_title': __('Close these announcements'),
                'icon_class': 'fa-times',
                'name': 'close',
                'standalone': api.settings.get("view_mode") === 'overlayed',
            });
        }
        return _converse.api.hook('getHeadingButtons', this, buttons);
    },

    // Override to avoid the methods in converse-chatview.js
    'renderMessageForm': function renderMessageForm () {},
    'afterShown': function afterShown () {}
});


/**
 * View which renders headlines section of the control box.
 * @class
 * @namespace _converse.HeadlinesPanel
 * @memberOf _converse
 */
export const HeadlinesPanel = View.extend({
    tagName: 'div',
    className: 'controlbox-section',
    id: 'headline',

    events: {
        'click .open-headline': 'openHeadline'
    },

    initialize () {
        this.listenTo(this.model, 'add', this.renderIfHeadline)
        this.listenTo(this.model, 'remove', this.renderIfHeadline)
        this.listenTo(this.model, 'destroy', this.renderIfHeadline)
        this.render();
        this.insertIntoDOM();
    },

    toHTML () {
        return tpl_headline_panel({
            'heading_headline': __('Announcements'),
            'headlineboxes': this.model.filter(m => m.get('type') === _converse.HEADLINES_TYPE),
            'open_title': __('Click to open this server message'),
        });
    },

    renderIfHeadline (model) {
        return (model && model.get('type') === _converse.HEADLINES_TYPE) && this.render();
    },

    openHeadline (ev) {
        ev.preventDefault();
        const jid = ev.target.getAttribute('data-headline-jid');
        const chat = _converse.chatboxes.get(jid);
        chat.maybeShow(true);
    },

    insertIntoDOM () {
        const view = _converse.chatboxviews.get('controlbox');
        view && view.el.querySelector('.controlbox-pane').insertAdjacentElement('beforeEnd', this.el);
    }
});


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
                this.renderHeadlinesPanel();
            },
        },
    },


    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */

        const viewWithHeadlinesPanel = {
            renderHeadlinesPanel () {
                if (this.headlinepanel && u.isInDOM(this.headlinepanel.el)) {
                    return this.headlinepanel;
                }
                this.headlinepanel = new _converse.HeadlinesPanel({'model': _converse.chatboxes});
                /**
                 * Triggered once the section of the { @link _converse.ControlBoxView }
                 * which shows announcements has been rendered.
                 * @event _converse#headlinesPanelRendered
                 * @example _converse.api.listen.on('headlinesPanelRendered', () => { ... });
                 */
                api.trigger('headlinesPanelRendered');
                return this.headlinepanel;
            }
        }

        if (_converse.ControlBoxView) {
            Object.assign(_converse.ControlBoxView.prototype, viewWithHeadlinesPanel);
        }

        _converse.HeadlinesBoxView = HeadlinesBoxView;
        _converse.HeadlinesPanel = HeadlinesPanel;


        /************************ BEGIN Event Handlers ************************/
        api.listen.on('chatBoxViewsInitialized', () => {
            const views = _converse.chatboxviews;
            _converse.chatboxes.on('add', item => {
                if (!views.get(item.get('id')) && item.get('type') === _converse.HEADLINES_TYPE) {
                    views.add(item.get('id'), new _converse.HeadlinesBoxView({model: item}));
                }
            });
        });
    }
});
