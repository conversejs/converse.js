// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, window */

(function (root, factory) {
    define("converse-headline", [
            "converse-core",
            "converse-api",
            "converse-chatview"
    ], factory);
}(this, function (converse, converse_api) {
    "use strict";
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._,
        utils = converse_api.env.utils,
        __ = utils.__.bind(converse);

    var onHeadlineMessage = function (message) {
        /* Handler method for all incoming messages of type "headline".
         */
        var $message = $(message),
            from_jid = $message.attr('from');
        if (utils.isHeadlineMessage(message)) {
            converse.chatboxes.create({
                'id': from_jid,
                'jid': from_jid,
                'fullname':  from_jid,
                'type': 'headline'
            }).createMessage($message);
            converse.emit('message', message);
        }
        return true;
    };

    converse_api.plugins.add('headline', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.
            
            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if (!view && item.get('type') === 'headline') {
                        view = new converse.HeadlinesBoxView({model: item});
                        this.add(item.get('id'), view);
                        return view;
                    } else {
                        return this._super.onChatBoxAdded.apply(this, arguments);
                    }
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            converse.HeadlinesBoxView = converse.ChatBoxView.extend({
                className: 'chatbox headlines',

                events: {
                    'click .close-chatbox-button': 'close',
                    'click .toggle-chatbox-button': 'minimize',
                    'keypress textarea.chat-textarea': 'keyPressed',
                    'mousedown .dragresize-top': 'onStartVerticalResize',
                    'mousedown .dragresize-left': 'onStartHorizontalResize',
                    'mousedown .dragresize-topleft': 'onStartDiagonalResize'
                },

                initialize: function () {
                    this.disable_mam = true; // Don't do MAM queries for this box
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('change:minimized', this.onMinimizedChanged, this);
                    this.render().fetchMessages().insertIntoPage().hide();
                    converse.emit('chatBoxInitialized', this);
                },

                render: function () {
                    this.$el.attr('id', this.model.get('box_id'))
                        .html(converse.templates.chatbox(
                                _.extend(this.model.toJSON(), {
                                        show_toolbar: converse.show_toolbar,
                                        show_textarea: false,
                                        title: this.model.get('fullname'),
                                        info_close: __('Close this box'),
                                        info_minimize: __('Minimize this box'),
                                        label_personal_message: ''
                                    }
                                )
                            )
                        );
                    this.setWidth();
                    this.$content = this.$el.find('.chat-content');
                    converse.emit('chatBoxOpened', this);
                    window.setTimeout(utils.refreshWebkit, 50);
                    return this;
                }
            });

            var registerHeadlineHandler = function () {
                converse.connection.addHandler(
                        onHeadlineMessage, null, 'message');
            };
            converse.on('connected', registerHeadlineHandler);
            converse.on('reconnected', registerHeadlineHandler);
        }
    });
}));
