// Converse.js
// http://conversejs.org
//
// Copyright (c) 2012-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

(function (root, factory) {
    define(["converse-core",
            "bootstrap",
            "emojione",
            "xss",
            "templates/chatbox.html",
            "templates/chatbox_head.html",
            "templates/chatbox_message_form.html",
            "templates/emojis.html",
            "templates/error_message.html",
            "templates/help_message.html",
            "templates/info.html",
            "templates/new_day.html",
            "templates/user_details_modal.html",
            "templates/toolbar_fileupload.html",
            "templates/spinner.html",
            "templates/spoiler_button.html",
            "templates/status_message.html",
            "templates/toolbar.html",
            "converse-modal",
            "converse-chatboxes",
            "converse-message-view"
    ], factory);
}(this, function (
            converse,
            bootstrap,
            emojione,
            xss,
            tpl_chatbox,
            tpl_chatbox_head,
            tpl_chatbox_message_form,
            tpl_emojis,
            tpl_error_message,
            tpl_help_message,
            tpl_info,
            tpl_new_day,
            tpl_user_details_modal,
            tpl_toolbar_fileupload,
            tpl_spinner,
            tpl_spoiler_button,
            tpl_status_message,
            tpl_toolbar
    ) {
    "use strict";
    const { $msg, Backbone, Promise, Strophe, _, b64_sha1, f, sizzle, moment } = converse.env;
    const u = converse.env.utils;

    converse.plugins.add('converse-chatview', {
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
        dependencies: ["converse-chatboxes", "converse-disco", "converse-message-view", "converse-modal"],

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.
            //
            ChatBoxViews: {
                onChatBoxAdded (item) {
                    const { _converse } = this.__super__;
                    let view = this.get(item.get('id'));
                    if (!view) {
                        view = new _converse.ChatBoxView({model: item});
                        this.add(item.get('id'), view);
                        return view;
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
                    }
                }
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                { __ } = _converse;

            _converse.api.settings.update({
                'emojione_image_path': emojione.imagePathPNG,
                'show_send_button': false,
                'show_toolbar': true,
                'time_format': 'HH:mm',
                'use_emojione': false,
                'visible_toolbar_buttons': {
                    'call': false,
                    'clear': true,
                    'emoji': true,
                    'spoiler': true
                },
            });
            emojione.imagePathPNG = _converse.emojione_image_path;
            emojione.ascii = true;

            function onWindowStateChanged (data) {
                _converse.chatboxviews.each(function (chatboxview) {
                    chatboxview.onWindowStateChanged(data.state);
                });
            }
            _converse.api.listen.on('windowStateChanged', onWindowStateChanged);

            _converse.EmojiPicker = Backbone.Model.extend({
                defaults: {
                    'current_category': 'people',
                    'current_skintone': '',
                    'scroll_position': 0
                },
                initialize () {
                    const id = `converse.emoji-${_converse.bare_jid}`;
                    this.id = id;
                    this.browserStorage = new Backbone.BrowserStorage[_converse.storage](id);
                }
            });

            _converse.EmojiPickerView = Backbone.VDOMView.extend({
                className: 'emoji-picker-container',
                events: {
                    'click .emoji-category-picker li.emoji-category': 'chooseCategory',
                    'click .emoji-skintone-picker li.emoji-skintone': 'chooseSkinTone'
                },

                initialize () {
                    this.model.on('change:current_skintone', this.render, this);
                    this.model.on('change:current_category', this.render, this);
                },

                toHTML () {
                    return tpl_emojis(
                        _.extend(
                            this.model.toJSON(), {
                                '_': _,
                                'transform': _converse.use_emojione ? emojione.shortnameToImage : emojione.shortnameToUnicode,
                                'emojis_by_category': u.getEmojisByCategory(_converse, emojione),
                                'toned_emojis': u.getTonedEmojis(_converse),
                                'skintones': ['tone1', 'tone2', 'tone3', 'tone4', 'tone5'],
                                'shouldBeHidden': this.shouldBeHidden
                            }
                        ));
                },

                shouldBeHidden (shortname, current_skintone, toned_emojis) {
                    /* Helper method for the template which decides whether an
                     * emoji should be hidden, based on which skin tone is
                     * currently being applied.
                     */
                    if (_.includes(shortname, '_tone')) {
                        if (!current_skintone || !_.includes(shortname, current_skintone)) {
                            return true;
                        }
                    } else {
                        if (current_skintone && _.includes(toned_emojis, shortname)) {
                            return true;
                        }
                    }
                    return false;
                },

                chooseSkinTone (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const target = ev.target.nodeName === 'IMG' ?
                        ev.target.parentElement : ev.target;
                    const skintone = target.getAttribute("data-skintone").trim();
                    if (this.model.get('current_skintone') === skintone) {
                        this.model.save({'current_skintone': ''});
                    } else {
                        this.model.save({'current_skintone': skintone});
                    }
                },

                chooseCategory (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const target = ev.target.nodeName === 'IMG' ?
                        ev.target.parentElement : ev.target;
                    const category = target.getAttribute("data-category").trim();
                    this.model.save({
                        'current_category': category,
                        'scroll_position': 0
                    });
                }
            });


            _converse.ChatBoxHeading = _converse.ViewWithAvatar.extend({
                initialize () {
                    this.model.on('change:status', this.onStatusMessageChanged, this);
                    this.model.vcard.on('change', this.render, this);
                },

                render () {
                    this.el.innerHTML = tpl_chatbox_head(
                        _.extend(
                            this.model.toJSON(),
                            this.model.vcard.toJSON(),
                            { '_converse': _converse,
                              'info_close': __('Close this chat box')
                            }
                        )
                    );
                    this.renderAvatar();
                    return this;
                },

                onStatusMessageChanged (item) {
                    this.render();
                    _converse.emit('contactStatusMessageChanged', {
                        'contact': item.attributes,
                        'message': item.get('status')
                    });
                }
            });


            _converse.UserDetailsModal = _converse.BootstrapModal.extend({

                events: {
                    'click button.remove-contact': 'removeContact',
                    'click button.refresh-contact': 'refreshContact'
                },

                initialize () {
                    _converse.BootstrapModal.prototype.initialize.apply(this, arguments);
                    this.model.on('contactAdded', this.registerContactEventHandlers, this);
                    this.registerContactEventHandlers();
                },

                toHTML () {
                    return tpl_user_details_modal(_.extend(
                        this.model.toJSON(),
                        this.model.vcard.toJSON(), {
                        'allow_contact_removal': _converse.allow_contact_removal,
                        'alt_profile_image': __("The User's Profile Image"),
                        'display_name': this.model.getDisplayName(),
                        'is_roster_contact': !_.isUndefined(this.model.contact),
                        'label_close': __('Close'),
                        'label_email': __('Email'),
                        'label_fullname': __('Full Name'),
                        'label_jid': __('Jabber ID'),
                        'label_nickname': __('Nickname'),
                        'label_remove': __('Remove as contact'),
                        'label_refresh': __('Refresh'),
                        'label_role': __('Role'),
                        'label_url': __('URL')
                    }));
                },

                registerContactEventHandlers () {
                    if (!_.isUndefined(this.model.contact)) {
                        this.model.contact.on('change', this.render, this);
                        this.model.contact.vcard.on('change', this.render, this);
                        this.model.contact.on('destroy', () => {
                            delete this.model.contact;
                            this.render();
                        });
                    }
                },

                refreshContact (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    const refresh_icon = this.el.querySelector('.fa-refresh');
                    u.addClass('fa-spin', refresh_icon);
                    _converse.api.vcard.update(this.model.contact.vcard, true)
                        .then(() => u.removeClass('fa-spin', refresh_icon))
                        .catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                },

                removeContact (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (!_converse.allow_contact_removal) { return; }
                    const result = confirm(__("Are you sure you want to remove this contact?"));
                    if (result === true) {
                        this.modal.hide();
                        this.model.contact.removeFromRoster(
                            (iq) => {
                                this.model.contact.destroy();
                            },
                            (err) => {
                                _converse.log(err, Strophe.LogLevel.ERROR);
                                _converse.api.alert.show(
                                    Strophe.LogLevel.ERROR,
                                    __('Error'),
                                    [__('Sorry, there was an error while trying to remove %1$s as a contact.',
                                        this.model.contact.getDisplayName())
                                    ]
                                )
                            }
                        );
                    }
                },
            });


            _converse.ChatBoxView = Backbone.NativeView.extend({
                length: 200,
                className: 'chatbox hidden',
                is_chatroom: false,  // Leaky abstraction from MUC

                events: {
                    'change input.fileupload': 'onFileSelection',
                    'click .chat-msg__action-edit': 'onMessageEditButtonClicked',
                    'click .chatbox-navback': 'showControlBox',
                    'click .close-chatbox-button': 'close',
                    'click .new-msgs-indicator': 'viewUnreadMessages',
                    'click .send-button': 'onFormSubmitted',
                    'click .show-user-details-modal': 'showUserDetailsModal',
                    'click .spoiler-toggle': 'toggleSpoilerMessage',
                    'click .toggle-call': 'toggleCall',
                    'click .toggle-clear': 'clearMessages',
                    'click .toggle-compose-spoiler': 'toggleComposeSpoilerMessage',
                    'click .toggle-smiley ul.emoji-picker li': 'insertEmoji',
                    'click .toggle-smiley': 'toggleEmojiMenu',
                    'click .upload-file': 'toggleFileUpload',
                    'input .chat-textarea': 'inputChanged',
                    'keydown .chat-textarea': 'keyPressed'
                },

                initialize () {
                    this.initDebounced();

                    this.createEmojiPicker();
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.messages.on('rendered', this.scrollDown, this);

                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.remove, this);

                    this.model.presence.on('change:show', this.onPresenceChanged, this);
                    this.model.on('showHelpMessages', this.showHelpMessages, this);
                    this.render();

                    this.fetchMessages();
                    _converse.emit('chatBoxOpened', this);
                    _converse.emit('chatBoxInitialized', this);
                },

                initDebounced () {
                    this.scrollDown = _.debounce(this._scrollDown, 250);
                    this.markScrolled = _.debounce(this._markScrolled, 100);
                    this.show = _.debounce(this._show, 250, {'leading': true});
                },

                render () {
                    // XXX: Is this still needed?
                    this.el.setAttribute('id', this.model.get('box_id'));
                    this.el.innerHTML = tpl_chatbox(
                        _.extend(this.model.toJSON(), {
                                unread_msgs: __('You have unread messages')
                            }
                        ));
                    this.content = this.el.querySelector('.chat-content');
                    this.renderMessageForm();
                    this.insertHeading();
                    return this;
                },

                renderToolbar (toolbar, options) {
                    if (!_converse.show_toolbar) {
                        return this;
                    }
                    toolbar = toolbar || tpl_toolbar;
                    options = _.assign(
                        this.model.toJSON(),
                        this.getToolbarOptions(options || {})
                    );
                    this.el.querySelector('.chat-toolbar').innerHTML = toolbar(options);
                    this.addSpoilerButton(options);
                    this.addFileUploadButton();
                    this.insertEmojiPicker();
                    return this;
                },

                renderMessageForm () {
                    let placeholder;
                    if (this.model.get('composing_spoiler')) {
                        placeholder = __('Hidden message');
                    } else {
                        placeholder = __('Personal message');
                    }
                    const form_container = this.el.querySelector('.message-form-container');
                    form_container.innerHTML = tpl_chatbox_message_form(
                        _.extend(this.model.toJSON(), {
                            'hint_value': _.get(this.el.querySelector('.spoiler-hint'), 'value'),
                            'label_personal_message': placeholder,
                            'label_send': __('Send'),
                            'label_spoiler_hint': __('Optional hint'),
                            'message_value': _.get(this.el.querySelector('.chat-textarea'), 'value'),
                            'show_send_button': _converse.show_send_button,
                            'show_toolbar': _converse.show_toolbar,
                            'unread_msgs': __('You have unread messages')
                        }));
                    this.renderToolbar();
                },

                showControlBox () {
                    // Used in mobile view, to navigate back to the controlbox
                    const view = _converse.chatboxviews.get('controlbox');
                    view.show();
                    this.hide();
                },

                showUserDetailsModal (ev) {
                    ev.preventDefault();
                    if (_.isUndefined(this.user_details_modal)) {
                        this.user_details_modal = new _converse.UserDetailsModal({model: this.model});
                    }
                    this.user_details_modal.show(ev);
                },

                toggleFileUpload (ev) {
                    this.el.querySelector('input.fileupload').click();
                },

                onFileSelection (evt) {
                    this.model.sendFiles(evt.target.files);
                },

                addFileUploadButton (options) {
                    _converse.api.disco.supports(Strophe.NS.HTTPUPLOAD, _converse.domain).then((result) => {
                        if (result.length) {
                            this.el.querySelector('.chat-toolbar').insertAdjacentHTML(
                                'beforeend',
                                tpl_toolbar_fileupload({'tooltip_upload_file': __('Choose a file to send')}));
                        }
                    }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                },

                addSpoilerButton (options) {
                    /* Asynchronously adds a button for writing spoiler
                     * messages, based on whether the contact's client supports
                     * it.
                     */
                    if (!options.show_spoiler_button || this.model.get('type') === 'chatroom') {
                        return;
                    }
                    const contact_jid = this.model.get('jid');
                    const resources = this.model.presence.get('resources');
                    if (_.isEmpty(resources)) {
                        return;
                    }
                    Promise.all(_.map(_.keys(resources), (resource) =>
                        _converse.api.disco.supports(Strophe.NS.SPOILER, `${contact_jid}/${resource}`)
                    )).then((results) => {
                        if (_.filter(results, 'length').length) {
                            const html = tpl_spoiler_button(this.model.toJSON());
                            if (_converse.visible_toolbar_buttons.emoji) {
                                this.el.querySelector('.toggle-smiley').insertAdjacentHTML('afterEnd', html);
                            } else {
                                this.el.querySelector('.chat-toolbar').insertAdjacentHTML('afterBegin', html);
                            }
                        }
                    }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                },

                insertHeading () {
                    this.heading = new _converse.ChatBoxHeading({'model': this.model});
                    this.heading.render();
                    this.heading.chatview = this;

                    if (!_.isUndefined(this.model.contact)) {
                        this.model.contact.on('destroy', this.heading.render, this);
                    }
                    const flyout = this.el.querySelector('.flyout');
                    flyout.insertBefore(this.heading.el, flyout.querySelector('.chat-body'));
                    return this;
                },

                getToolbarOptions (options) {
                    let label_toggle_spoiler;
                    if (this.model.get('composing_spoiler')) {
                        label_toggle_spoiler = __('Click to write as a normal (non-spoiler) message');
                    } else {
                        label_toggle_spoiler = __('Click to write your message as a spoiler');
                    }
                    return _.extend(options || {}, {
                        'label_clear': __('Clear all messages'),
                        'tooltip_insert_smiley': __('Insert emojis'),
                        'tooltip_start_call': __('Start a call'),
                        'label_toggle_spoiler': label_toggle_spoiler,
                        'show_call_button': _converse.visible_toolbar_buttons.call,
                        'show_spoiler_button': _converse.visible_toolbar_buttons.spoiler,
                        'use_emoji': _converse.visible_toolbar_buttons.emoji,
                    });
                },

                afterMessagesFetched () {
                    this.insertIntoDOM();
                    this.scrollDown();
                    this.content.addEventListener('scroll', this.markScrolled.bind(this));
                    _converse.emit('afterMessagesFetched', this);
                },

                fetchMessages () {
                    this.model.messages.fetch({
                        'add': true,
                        'success': this.afterMessagesFetched.bind(this),
                        'error': this.afterMessagesFetched.bind(this),
                    });
                    return this;
                },

                insertIntoDOM () {
                    /* This method gets overridden in src/converse-controlbox.js
                     * as well as src/converse-muc.js (if those plugins are
                     * enabled).
                     */
                    _converse.chatboxviews.insertRowColumn(this.el);
                    return this;
                },

                showChatEvent (message, data='') {
                    const isodate = moment().format();
                    this.content.insertAdjacentHTML(
                        'beforeend',
                        tpl_info({
                            'extra_classes': 'chat-event',
                            'message': message,
                            'isodate': isodate,
                            'data': data
                        }));
                    this.insertDayIndicator(this.content.lastElementChild);
                    this.scrollDown();
                    return isodate;
                },

                showErrorMessage (message) {
                    this.content.insertAdjacentHTML(
                        'beforeend',
                        tpl_error_message({'message': message, 'isodate': moment().format() })
                    );
                    this.scrollDown();
                },

                addSpinner (append=false) {
                    if (_.isNull(this.el.querySelector('.spinner'))) {
                        if (append) {
                            this.content.insertAdjacentHTML('beforeend', tpl_spinner());
                            this.scrollDown();
                        } else {
                            this.content.insertAdjacentHTML('afterbegin', tpl_spinner());
                        }
                    }
                },

                clearSpinner () {
                    _.each(
                        this.content.querySelectorAll('span.spinner'),
                        (el) => el.parentNode.removeChild(el)
                    );
                },

                insertDayIndicator (next_msg_el) {
                    /* Inserts an indicator into the chat area, showing the
                     * day as given by the passed in date.
                     *
                     * The indicator is only inserted if necessary.
                     *
                     * Parameters:
                     *  (HTMLElement) next_msg_el - The message element before
                     *      which the day indicator element must be inserted.
                     *      This element must have a "data-isodate" attribute
                     *      which specifies its creation date.
                     */
                    const prev_msg_el = u.getPreviousElement(next_msg_el, ".message:not(.chat-state-notification)"),
                          prev_msg_date = _.isNull(prev_msg_el) ? null : prev_msg_el.getAttribute('data-isodate'),
                          next_msg_date = next_msg_el.getAttribute('data-isodate');

                    if (_.isNull(prev_msg_date) || moment(next_msg_date).isAfter(prev_msg_date, 'day')) {
                        const day_date = moment(next_msg_date).startOf('day');
                        next_msg_el.insertAdjacentHTML('beforeBegin',
                            tpl_new_day({
                                'isodate': day_date.format(),
                                'datestring': day_date.format("dddd MMM Do YYYY")
                            })
                        );
                    }
                },

                getLastMessageDate (cutoff) {
                    /* Return the ISO8601 format date of the latest message.
                     *
                     * Parameters:
                     *  (Object) cutoff: Moment Date cutoff date. The last
                     *      message received cutoff this date will be returned.
                     */
                    const first_msg = u.getFirstChildElement(this.content, '.message:not(.chat-state-notification)'),
                          oldest_date = first_msg ? first_msg.getAttribute('data-isodate') : null;
                    if (!_.isNull(oldest_date) && moment(oldest_date).isAfter(cutoff)) {
                        return null;
                    }
                    const last_msg = u.getLastChildElement(this.content, '.message:not(.chat-state-notification)'),
                          most_recent_date = last_msg ? last_msg.getAttribute('data-isodate') : null;
                    if (_.isNull(most_recent_date) || moment(most_recent_date).isBefore(cutoff)) {
                        return most_recent_date;
                    }
                    /* XXX: We avoid .chat-state-notification messages, since they are
                     * temporary and get removed once a new element is
                     * inserted into the chat area, so we don't query for
                     * them here, otherwise we get a null reference later
                     * upon element insertion.
                     */
                    const msg_dates = _.invokeMap(
                        sizzle('.message:not(.chat-state-notification)', this.content),
                        Element.prototype.getAttribute, 'data-isodate'
                    )
                    if (_.isObject(cutoff)) {
                        cutoff = cutoff.format();
                    }
                    msg_dates.push(cutoff);
                    msg_dates.sort();
                    const idx = msg_dates.lastIndexOf(cutoff);
                    if (idx === 0) {
                        return null;
                    } else {
                        return msg_dates[idx-1];
                    }
                },

                setScrollPosition (message_el) {
                    /* Given a newly inserted message, determine whether we
                     * should keep the scrollbar in place (so as to not scroll
                     * up when using infinite scroll).
                     */
                    if (this.model.get('scrolled')) {
                        const next_msg_el = u.getNextElement(message_el, ".chat-msg");
                        if (next_msg_el) {
                            // The currently received message is not new, there
                            // are newer messages after it. So let's see if we
                            // should maintain our current scroll position.
                            if (this.content.scrollTop === 0 || this.model.get('top_visible_message')) {
                                const top_visible_message = this.model.get('top_visible_message') || next_msg_el;

                                this.model.set('top_visible_message', top_visible_message);
                                this.content.scrollTop = top_visible_message.offsetTop - 30;
                            }
                        }
                    } else {
                        this.scrollDown();
                    }
                },

                showHelpMessages (msgs, type, spinner) {
                    _.each(msgs, (msg) => {
                        this.content.insertAdjacentHTML(
                            'beforeend',
                            tpl_help_message({
                                'isodate': moment().format(),
                                'type': type,
                                'message': xss.filterXSS(msg, {'whiteList': {'strong': []}})
                            })
                        );
                    });
                    if (spinner === true) {
                        this.addSpinner();
                    } else if (spinner === false) {
                        this.clearSpinner();
                    }
                    return this.scrollDown();
                },

                clearChatStateNotification (message, isodate) {
                    if (isodate) {
                        _.each(
                            sizzle(`.chat-state-notification[data-csn="${message.get('from')}"][data-isodate="${isodate}"]`, this.content),
                            u.removeElement
                        );
                    } else {
                        _.each(sizzle(`.chat-state-notification[data-csn="${message.get('from')}"]`, this.content), u.removeElement);
                    }
                },

                shouldShowOnTextMessage () {
                    return !u.isVisible(this.el);
                },

                insertMessage (view) {
                    /* Given a view representing a message, insert it into the
                     * content area of the chat box.
                     *
                     * Parameters:
                     *  (Backbone.View) message: The message Backbone.View
                     */
                    if (view.model.get('type') === 'error') {
                        const previous_msg_el = this.content.querySelector(`[data-msgid="${view.model.get('msgid')}"]`);
                        if (previous_msg_el) {
                            return previous_msg_el.insertAdjacentElement('afterend', view.el);
                        }
                    }
                    const current_msg_date = moment(view.model.get('time')) || moment,
                            previous_msg_date = this.getLastMessageDate(current_msg_date);

                    if (_.isNull(previous_msg_date)) {
                        this.content.insertAdjacentElement('afterbegin', view.el);
                    } else {
                        const previous_msg_el = sizzle(`[data-isodate="${previous_msg_date}"]:last`, this.content).pop();
                        if (view.model.get('type') === 'error' &&
                                u.hasClass('chat-error', previous_msg_el) &&
                                previous_msg_el.textContent === view.model.get('message')) {
                            // We don't show a duplicate error message
                            return;
                        }
                        previous_msg_el.insertAdjacentElement('afterend', view.el);
                        this.markFollowups(view.el);
                    }
                },

                markFollowups (el) {
                    /* Given a message element, determine wether it should be
                     * marked as a followup message to the previous element.
                     *
                     * Also determine whether the element following it is a
                     * followup message or not.
                     *
                     * Followup messages are subsequent ones written by the same
                     * author with no other conversation elements inbetween and
                     * posted within 10 minutes of one another.
                     *
                     * Parameters:
                     *  (HTMLElement) el - The message element.
                     */
                    const from = el.getAttribute('data-from'),
                          previous_el = el.previousElementSibling,
                          date = moment(el.getAttribute('data-isodate')),
                          next_el = el.nextElementSibling;

                    if (!u.hasClass('chat-msg--action', el) && !u.hasClass('chat-msg--action', previous_el) &&
                            previous_el.getAttribute('data-from') === from &&
                            date.isBefore(moment(previous_el.getAttribute('data-isodate')).add(10, 'minutes'))) {
                        u.addClass('chat-msg--followup', el);
                    }
                    if (!next_el) { return; }

                    if (!u.hasClass('chat-msg--action', 'el') &&
                            next_el.getAttribute('data-from') === from &&
                            moment(next_el.getAttribute('data-isodate')).isBefore(date.add(10, 'minutes'))) {
                        u.addClass('chat-msg--followup', next_el);
                    } else {
                        u.removeClass('chat-msg--followup', next_el);
                    }
                },

                showMessage (message) {
                    /* Inserts a chat message into the content area of the chat box.
                     *
                     * Will also insert a new day indicator if the message is on a
                     * different day.
                     *
                     * Parameters:
                     *  (Backbone.Model) message: The message object
                     */
                    const view = new _converse.MessageView({'model': message});
                    this.clearChatStateNotification(message);
                    this.insertMessage(view);
                    this.insertDayIndicator(view.el);
                    this.setScrollPosition(view.el);

                    if (u.isNewMessage(message)) {
                        if (message.get('sender') === 'me') {
                            // We remove the "scrolled" flag so that the chat area
                            // gets scrolled down. We always want to scroll down
                            // when the user writes a message as opposed to when a
                            // message is received.
                            this.model.set('scrolled', false);
                        } else if (this.model.get('scrolled', true)) {
                            this.showNewMessagesIndicator();
                        }
                    }
                    if (this.shouldShowOnTextMessage()) {
                        this.show();
                    } else {
                        this.scrollDown();
                    }
                },

                onMessageAdded (message) {
                    /* Handler that gets called when a new message object is created.
                     *
                     * Parameters:
                     *    (Object) message - The message Backbone object that was added.
                     */
                    this.showMessage(message);
                    if (message.get('correcting')) {
                        this.insertIntoTextArea(message.get('message'), true, true);
                    }
                    _converse.emit('messageAdded', {
                        'message': message,
                        'chatbox': this.model
                    });
                },

                parseMessageForCommands (text) {
                    const match = text.replace(/^\s*/, "").match(/^\/(.*)\s*$/);
                    if (match) {
                        if (match[1] === "clear") {
                            this.clearMessages();
                            return true;
                        }
                        else if (match[1] === "help") {
                            const msgs = [
                                `<strong>/clear</strong>: ${__('Remove messages')}`,
                                `<strong>/me</strong>: ${__('Write in the third person')}`,
                                `<strong>/help</strong>: ${__('Show this menu')}`
                                ];
                            this.showHelpMessages(msgs);
                            return true;
                        }
                    }
                },

                onMessageSubmitted (text, spoiler_hint) {
                    /* This method gets called once the user has typed a message
                     * and then pressed enter in a chat box.
                     *
                     *  Parameters:
                     *    (String) text - The chat message text.
                     *    (String) spoiler_hint - A hint in case the message
                     *      text is a hidden/spoiler message. See XEP-0382
                     */
                    if (!_converse.connection.authenticated) {
                        return this.showHelpMessages(
                            ['Sorry, the connection has been lost, '+
                                'and your message could not be sent'],
                            'error'
                        );
                    }
                    if (this.parseMessageForCommands(text)) {
                        return;
                    }
                    const attrs = this.model.getOutgoingMessageAttributes(text, spoiler_hint);
                    this.model.sendMessage(attrs);
                },

                setChatState (state) {
                    /* Mutator for setting the chat state of this chat session.
                     * Handles clearing of any chat state notification timeouts and
                     * setting new ones if necessary.
                     * Timeouts are set when the  state being set is COMPOSING or PAUSED.
                     * After the timeout, COMPOSING will become PAUSED and PAUSED will become INACTIVE.
                     * See XEP-0085 Chat State Notifications.
                     *
                     *  Parameters:
                     *    (string) state - The chat state (consts ACTIVE, COMPOSING, PAUSED, INACTIVE, GONE)
                     */
                    if (!_.isUndefined(this.chat_state_timeout)) {
                        window.clearTimeout(this.chat_state_timeout);
                        delete this.chat_state_timeout;
                    }
                    if (state === _converse.COMPOSING) {
                        this.chat_state_timeout = window.setTimeout(
                            this.setChatState.bind(this),
                            _converse.TIMEOUTS.PAUSED,
                            _converse.PAUSED
                        );
                    } else if (state === _converse.PAUSED) {
                        this.chat_state_timeout = window.setTimeout(
                            this.setChatState.bind(this),
                            _converse.TIMEOUTS.INACTIVE,
                            _converse.INACTIVE
                        );
                    }
                    this.model.set('chat_state', state);
                    return this;
                },

                onFormSubmitted (ev) {
                    ev.preventDefault();
                    const textarea = this.el.querySelector('.chat-textarea'),
                          message = textarea.value;

                    if (!message.replace(/\s/g, '').length) {
                        return;
                    }
                    let spoiler_hint;
                    if (this.model.get('composing_spoiler')) {
                        const hint_el = this.el.querySelector('form.sendXMPPMessage input.spoiler-hint');
                        spoiler_hint = hint_el.value;
                        hint_el.value = '';
                    }
                    textarea.value = '';
                    u.removeClass('correcting', textarea);
                    textarea.focus();
                    // Trigger input event, so that the textarea resizes
                    const event = document.createEvent('Event');
                    event.initEvent('input', true, true);
                    textarea.dispatchEvent(event);

                    this.onMessageSubmitted(message, spoiler_hint);
                    _converse.emit('messageSend', message);
                    this.setChatState(_converse.ACTIVE);
                },

                keyPressed (ev) {
                    /* Event handler for when a key is pressed in a chat box textarea.
                     */
                    console.log('keypressed in chatview');
                    if (ev.ctrlKey) {
                        // When ctrl is pressed, no chars are entered into the textarea.
                        return;
                    }
                    if (!ev.shiftKey && !ev.altKey) {
                        if (ev.keyCode === _converse.keycodes.FORWARD_SLASH) {
                            // Forward slash is used to run commands. Nothing to do here.
                            return;
                        } else if (ev.keyCode === _converse.keycodes.ESCAPE) {
                            return this.onEscapePressed(ev);
                        } else if (ev.keyCode === _converse.keycodes.ENTER) {
                            return this.onFormSubmitted(ev);
                        } else if (ev.keyCode === _converse.keycodes.UP_ARROW && !ev.target.selectionEnd) {
                            return this.editEarlierMessage();
                        } else if (ev.keyCode === _converse.keycodes.DOWN_ARROW && ev.target.selectionEnd === ev.target.value.length) {
                            return this.editLaterMessage();
                        }
                    } 
                    if (_.includes([
                                _converse.keycodes.SHIFT,
                                _converse.keycodes.META,
                                _converse.keycodes.META_RIGHT,
                                _converse.keycodes.ESCAPE,
                                _converse.keycodes.ALT]
                            , ev.keyCode)) {
                        return;
                    }
                    if (this.model.get('chat_state') !== _converse.COMPOSING) {
                        // Set chat state to composing if keyCode is not a forward-slash
                        // (which would imply an internal command and not a message).
                        this.setChatState(_converse.COMPOSING);
                    }
                },

                getOwnMessages () {
                    return f(this.model.messages.filter({'sender': 'me'}));
                },

                onEscapePressed (ev) {
                    ev.preventDefault();
                    const idx = this.model.messages.findLastIndex('correcting'),
                          message = idx >=0 ? this.model.messages.at(idx) : null;

                    if (message) {
                        message.save('correcting', false);
                    }
                    this.insertIntoTextArea('', true, false);
                },

                onMessageEditButtonClicked (ev) {
                    ev.preventDefault();
                    const idx = this.model.messages.findLastIndex('correcting'),
                          currently_correcting = idx >=0 ? this.model.messages.at(idx) : null,
                          message_el = u.ancestor(ev.target, '.chat-msg'),
                          message = this.model.messages.findWhere({'msgid': message_el.getAttribute('data-msgid')});

                    if (currently_correcting !== message) {
                        if (!_.isNil(currently_correcting)) {
                            currently_correcting.save('correcting', false);
                        }
                        message.save('correcting', true);
                        this.insertIntoTextArea(message.get('message'), true, true);
                    } else {
                        message.save('correcting', false);
                        this.insertIntoTextArea('', true, false);
                    }
                },

                editLaterMessage () {
                    let message;
                    let idx = this.model.messages.findLastIndex('correcting');
                    if (idx >= 0) {
                        this.model.messages.at(idx).save('correcting', false);
                        while (idx < this.model.messages.length-1) {
                            idx += 1;
                            const candidate = this.model.messages.at(idx);
                            if (candidate.get('sender') === 'me' && candidate.get('message')) {
                                message = candidate;
                                break;
                            }
                        }
                    }
                    if (message) {
                        this.insertIntoTextArea(message.get('message'), true, true);
                        message.save('correcting', true);
                    } else {
                        this.insertIntoTextArea('', true, false);
                    }
                },

                editEarlierMessage () {
                    let message;
                    let idx = this.model.messages.findLastIndex('correcting');
                    if (idx >= 0) {
                        this.model.messages.at(idx).save('correcting', false);
                        while (idx > 0) {
                            idx -= 1;
                            const candidate = this.model.messages.at(idx);
                            if (candidate.get('sender') === 'me' && candidate.get('message')) {
                                message = candidate;
                                break;
                            }
                        }
                    }
                    message = message || this.getOwnMessages().findLast((msg) => msg.get('message'));
                    if (message) {
                        this.insertIntoTextArea(message.get('message'), true, true);
                        message.save('correcting', true);
                    }
                },

                inputChanged (ev) {
                    ev.target.style.height = 'auto'; // Fixes weirdness
                    ev.target.style.height = (ev.target.scrollHeight) + 'px';
                },

                clearMessages (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    const result = confirm(__("Are you sure you want to clear the messages from this conversation?"));
                    if (result === true) {
                        this.content.innerHTML = '';
                        this.model.messages.reset();
                        this.model.messages.browserStorage._clear();
                    }
                    return this;
                },

                insertIntoTextArea (value, replace=false, correcting=false) {
                    const textarea = this.el.querySelector('.chat-textarea');
                    if (correcting) {
                        u.addClass('correcting', textarea);
                    } else {
                        u.removeClass('correcting', textarea);
                    }
                    if (replace) {
                        textarea.value = '';
                        textarea.value = value;
                    } else {
                        let existing = textarea.value;
                        if (existing && (existing[existing.length-1] !== ' ')) {
                            existing = existing + ' ';
                        }
                        textarea.value = '';
                        textarea.value = existing+value+' ';
                    }
                    u.putCurserAtEnd(textarea);
                },

                createEmojiPicker () {
                    if (_.isUndefined(_converse.emojipicker)) {
                        _converse.emojipicker = new _converse.EmojiPicker();
                        _converse.emojipicker.fetch();
                    }
                    this.emoji_picker_view = new _converse.EmojiPickerView({
                        'model': _converse.emojipicker
                    });
                },

                insertEmoji (ev) {
                    ev.stopPropagation();
                    const target = ev.target.nodeName === 'IMG' ? ev.target.parentElement : ev.target;
                    this.insertIntoTextArea(target.getAttribute('data-emoji'));
                },

                toggleEmojiMenu (ev) {
                    if (_.isUndefined(this.emoji_dropdown)) {
                        ev.stopPropagation();
                        const dropdown_el = this.el.querySelector('.toggle-smiley.dropup');
                        this.emoji_dropdown = new bootstrap.Dropdown(dropdown_el, true);
                        this.emoji_dropdown.toggle();
                    }
                },

                toggleCall (ev) {
                    ev.stopPropagation();
                    _converse.emit('callButtonClicked', {
                        connection: _converse.connection,
                        model: this.model
                    });
                },

                toggleComposeSpoilerMessage () {
                    this.model.set('composing_spoiler', !this.model.get('composing_spoiler'));
                    this.renderMessageForm();
                    this.focus();
                },

                toggleSpoilerMessage (ev) {
                    if (ev && ev.preventDefault) {
                        ev.preventDefault();
                    }
                    const toggle_el = ev.target,
                        icon_el = toggle_el.firstElementChild;

                    u.slideToggleElement(
                        toggle_el.parentElement.parentElement.querySelector('.spoiler')
                    );
                    if (toggle_el.getAttribute("data-toggle-state") == "closed") {
                        toggle_el.textContent = 'Show less';
                        icon_el.classList.remove("fa-eye");
                        icon_el.classList.add("fa-eye-slash");
                        toggle_el.insertAdjacentElement('afterBegin', icon_el);
                        toggle_el.setAttribute("data-toggle-state", "open");
                    } else {
                        toggle_el.textContent = 'Show more';
                        icon_el.classList.remove("fa-eye-slash");
                        icon_el.classList.add("fa-eye");
                        toggle_el.insertAdjacentElement('afterBegin', icon_el);
                        toggle_el.setAttribute("data-toggle-state", "closed");
                    }
                },

                onPresenceChanged (item) {
                    const show = item.get('show'),
                          fullname = this.model.getDisplayName();

                    let text;
                    if (u.isVisible(this.el)) {
                        if (show === 'offline') {
                            text = __('%1$s has gone offline', fullname);
                        } else if (show === 'away') {
                            text = __('%1$s has gone away', fullname);
                        } else if ((show === 'dnd')) {
                            text = __('%1$s is busy', fullname);
                        } else if (show === 'online') {
                            text = __('%1$s is online', fullname);
                        }
                        if (text) {
                            this.content.insertAdjacentHTML(
                                'beforeend',
                                tpl_status_message({
                                    'message': text,
                                    'isodate': moment().format(),
                                }));
                            this.scrollDown();
                        }
                    }
                },

                close (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (Backbone.history.getFragment() === "converse/chat?jid="+this.model.get('jid')) {
                        _converse.router.navigate('');
                    }
                    if (_converse.connection.connected) {
                        // Immediately sending the chat state, because the
                        // model is going to be destroyed afterwards.
                        this.setChatState(_converse.INACTIVE);
                        this.model.sendChatState();
                    }
                    try {
                        this.model.destroy();
                    } catch (e) {
                        _converse.log(e, Strophe.LogLevel.ERROR);
                    }
                    this.remove();
                    _converse.emit('chatBoxClosed', this);
                    return this;
                },

                renderEmojiPicker () {
                    this.emoji_picker_view.render();
                },

                insertEmojiPicker () {
                    var picker_el = this.el.querySelector('.emoji-picker');
                    if (!_.isNull(picker_el)) {
                        picker_el.innerHTML = '';
                        picker_el.appendChild(this.emoji_picker_view.el);
                    }
                },

                focus () {
                    const textarea_el = this.el.querySelector('.chat-textarea');
                    if (!_.isNull(textarea_el)) {
                        textarea_el.focus();
                        _converse.emit('chatBoxFocused', this);
                    }
                    return this;
                },

                hide () {
                    this.el.classList.add('hidden');
                    return this;
                },

                afterShown () {
                    this.model.clearUnreadMsgCounter();
                    this.setChatState(_converse.ACTIVE);
                    this.renderEmojiPicker();
                    this.scrollDown();
                    this.focus();
                },

                _show (f) {
                    /* Inner show method that gets debounced */
                    if (u.isVisible(this.el)) {
                        this.focus();
                        return;
                    }
                    u.fadeIn(this.el, _.bind(this.afterShown, this));
                },

                showNewMessagesIndicator () {
                    u.showElement(this.el.querySelector('.new-msgs-indicator'));
                },

                hideNewMessagesIndicator () {
                    const new_msgs_indicator = this.el.querySelector('.new-msgs-indicator');
                    if (!_.isNull(new_msgs_indicator)) {
                        new_msgs_indicator.classList.add('hidden');
                    }
                },

                _markScrolled: function (ev) {
                    /* Called when the chat content is scrolled up or down.
                     * We want to record when the user has scrolled away from
                     * the bottom, so that we don't automatically scroll away
                     * from what the user is reading when new messages are
                     * received.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    let scrolled = true;
                    const is_at_bottom =
                        (this.content.scrollTop + this.content.clientHeight) >=
                            this.content.scrollHeight - 62; // sigh...

                    if (is_at_bottom) {
                        scrolled = false;
                        this.onScrolledDown();
                    }
                    u.safeSave(this.model, {
                        'scrolled': scrolled,
                        'top_visible_message': null
                    });
                },

                viewUnreadMessages () {
                    this.model.save({
                        'scrolled': false,
                        'top_visible_message': null
                    });
                    this.scrollDown();
                },

                _scrollDown () {
                    /* Inner method that gets debounced */
                    if (_.isUndefined(this.content)) {
                        return;
                    }
                    if (u.isVisible(this.content) && !this.model.get('scrolled')) {
                        this.content.scrollTop = this.content.scrollHeight;
                    }
                },

                onScrolledDown () {
                    this.hideNewMessagesIndicator();
                    if (_converse.windowState !== 'hidden') {
                        this.model.clearUnreadMsgCounter();
                    }
                    _converse.emit('chatBoxScrolledDown', {'chatbox': this.model});
                },

                onWindowStateChanged (state) {
                    if (this.model.get('num_unread', 0) && !this.model.isHidden()) {
                        this.model.clearUnreadMsgCounter();
                    }
                }
            });

            _converse.on('connected', () => {
                // Advertise that we support XEP-0382 Message Spoilers
                _converse.api.disco.own.features.add(Strophe.NS.SPOILER);
            });

            /************************ BEGIN API ************************/
            _.extend(_converse.api, {
                'chatviews': {
                    'get' (jids) {
                        if (_.isUndefined(jids)) {
                            _converse.log(
                                "chats.create: You need to provide at least one JID",
                                Strophe.LogLevel.ERROR
                            );
                            return null;
                        }
                        if (_.isString(jids)) {
                            return _converse.chatboxviews.get(jids);
                        }
                        return _.map(jids, (jid) => _converse.chatboxviews.get(jids));
                    }
                }
            });
            /************************ END API ************************/
        }
    });

    return converse;
}));
