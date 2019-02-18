// Converse.js
// http://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

import "converse-chatboxviews";
import "converse-message-view";
import "converse-modal";
import * as twemoji from "twemoji";
import bootstrap from "bootstrap.native";
import converse from "@converse/headless/converse-core";
import tpl_alert from "templates/alert.html";
import tpl_chatbox from "templates/chatbox.html";
import tpl_chatbox_head from "templates/chatbox_head.html";
import tpl_chatbox_message_form from "templates/chatbox_message_form.html";
import tpl_emojis from "templates/emojis.html";
import tpl_error_message from "templates/error_message.html";
import tpl_help_message from "templates/help_message.html";
import tpl_info from "templates/info.html";
import tpl_new_day from "templates/new_day.html";
import tpl_spinner from "templates/spinner.html";
import tpl_spoiler_button from "templates/spoiler_button.html";
import tpl_status_message from "templates/status_message.html";
import tpl_toolbar from "templates/toolbar.html";
import tpl_toolbar_fileupload from "templates/toolbar_fileupload.html";
import tpl_user_details_modal from "templates/user_details_modal.html";
import u from "@converse/headless/utils/emoji";
import xss from "xss";

const { $msg, Backbone, Promise, Strophe, _, b64_sha1, f, sizzle, moment } = converse.env;


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
    dependencies: ["converse-chatboxviews", "converse-disco", "converse-message-view", "converse-modal"],


    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this,
            { __ } = _converse;

        _converse.api.settings.update({
            'emoji_image_path': twemoji.default.base,
            'show_send_button': false,
            'show_toolbar': true,
            'time_format': 'HH:mm',
            'use_system_emojis': true,
            'visible_toolbar_buttons': {
                'call': false,
                'clear': true,
                'emoji': true,
                'spoiler': true
            },
        });
        twemoji.default.base = _converse.emoji_image_path;

        function onWindowStateChanged (data) {
            if (_converse.chatboxviews) {
                _converse.chatboxviews.each(view => {
                    if (view.model.get('id') !== 'controlbox') {
                        view.onWindowStateChanged(data.state);
                    }
                });
            }
        }
        _converse.api.listen.on('windowStateChanged', onWindowStateChanged);


        _converse.EmojiPicker = Backbone.Model.extend({
            defaults: {
                'current_category': 'people',
                'current_skintone': '',
                'scroll_position': 0
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
                            'transform': u.getEmojiRenderer(_converse),
                            'emojis_by_category': u.getEmojisByCategory(_converse),
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
                        this.model.vcard.toJSON(),
                        this.model.toJSON(),
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
                'click button.refresh-contact': 'refreshContact',
                'click .fingerprint-trust .btn input': 'toggleDeviceTrust'
            },

            initialize () {
                _converse.BootstrapModal.prototype.initialize.apply(this, arguments);
                this.model.on('contactAdded', this.registerContactEventHandlers, this);
                this.model.on('change', this.render, this);
                this.registerContactEventHandlers();
                _converse.emit('userDetailsModalInitialized', this.model);
            },

            toHTML () {
                return tpl_user_details_modal(_.extend(
                    this.model.toJSON(),
                    this.model.vcard.toJSON(), {
                    '_': _,
                    '__': __,
                    'view': this,
                    '_converse': _converse,
                    'allow_contact_removal': _converse.allow_contact_removal,
                    'display_name': this.model.getDisplayName(),
                    'is_roster_contact': !_.isUndefined(this.model.contact),
                    'utils': u
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

            async refreshContact (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                const refresh_icon = this.el.querySelector('.fa-refresh');
                u.addClass('fa-spin', refresh_icon);
                try {
                    await _converse.api.vcard.update(this.model.contact.vcard, true);
                } catch (e) {
                    _converse.log(e, Strophe.LogLevel.FATAL);
                    this.el.querySelector('.modal-body').insertAdjacentHTML(
                        'afterBegin',
                        tpl_alert({
                            'type': 'alert-danger',
                            'message': __('Sorry, something went wrong while trying to refresh')
                        })
                    );
                }
                u.removeClass('fa-spin', refresh_icon);
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
                'keydown .chat-textarea': 'keyPressed',
                'dragover .chat-textarea': 'onDragOver',
                'drop .chat-textarea': 'onDrop',
            },

            initialize () {
                this.initDebounced();

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
                            'unread_msgs': __('You have unread messages')
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
                _converse.emit('renderToolbar', this);
                return this;
            },

            renderMessageForm () {
                let placeholder;
                if (this.model.get('composing_spoiler')) {
                    placeholder = __('Hidden message');
                } else {
                    placeholder = __('Message');
                }
                const form_container = this.el.querySelector('.message-form-container');
                form_container.innerHTML = tpl_chatbox_message_form(
                    _.extend(this.model.toJSON(), {
                        'hint_value': _.get(this.el.querySelector('.spoiler-hint'), 'value'),
                        'label_message': placeholder,
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

            onDragOver (evt) {
                evt.preventDefault();
            },

            onDrop (evt) {
                if (evt.dataTransfer.files.length == 0)
                    // There are no files to be dropped, so this isn’t a file
                    // transfer operation.
                    return;
                evt.preventDefault();
                this.model.sendFiles(evt.dataTransfer.files);
            },

            async addFileUploadButton (options) {
                const result = await _converse.api.disco.supports(Strophe.NS.HTTPUPLOAD, _converse.domain);
                if (result.length) {
                    this.el.querySelector('.chat-toolbar').insertAdjacentHTML(
                        'beforeend',
                        tpl_toolbar_fileupload({'tooltip_upload_file': __('Choose a file to send')}));
                }
            },

            async addSpoilerButton (options) {
                /* Asynchronously adds a button for writing spoiler
                 * messages, based on whether the contact's client supports
                 * it.
                 */
                if (!options.show_spoiler_button || this.model.get('type') === _converse.CHATROOMS_TYPE) {
                    return;
                }
                const contact_jid = this.model.get('jid');
                if (this.model.presence.resources.length === 0) {
                    return;
                }
                const results = await Promise.all(
                    this.model.presence.resources.map(
                        res => _converse.api.disco.supports(Strophe.NS.SPOILER, `${contact_jid}/${res.get('name')}`)
                    )
                );
                if (_.filter(results, 'length').length) {
                    const html = tpl_spoiler_button(this.model.toJSON());
                    if (_converse.visible_toolbar_buttons.emoji) {
                        this.el.querySelector('.toggle-smiley').insertAdjacentHTML('afterEnd', html);
                    } else {
                        this.el.querySelector('.chat-toolbar').insertAdjacentHTML('afterBegin', html);
                    }
                }
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

            showChatEvent (message) {
                const isodate = moment().format();
                this.content.insertAdjacentHTML(
                    'beforeend',
                    tpl_info({
                        'extra_classes': 'chat-event',
                        'message': message,
                        'isodate': isodate,
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

                if (_.isNull(prev_msg_date) && _.isNull(next_msg_date)) {
                    return;
                }
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
                        previous_msg_el.insertAdjacentElement('afterend', view.el);
                        return this.trigger('messageInserted', view.el);
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
                return this.trigger('messageInserted', view.el);
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
                        date.isBefore(moment(previous_el.getAttribute('data-isodate')).add(10, 'minutes')) &&
                        el.getAttribute('data-encrypted') === previous_el.getAttribute('data-encrypted')) {
                    u.addClass('chat-msg--followup', el);
                }
                if (!next_el) { return; }

                if (!u.hasClass('chat-msg--action', 'el') &&
                        next_el.getAttribute('data-from') === from &&
                        moment(next_el.getAttribute('data-isodate')).isBefore(date.add(10, 'minutes')) &&
                        el.getAttribute('data-encrypted') === next_el.getAttribute('data-encrypted')) {
                    u.addClass('chat-msg--followup', next_el);
                } else {
                    u.removeClass('chat-msg--followup', next_el);
                }
            },

            async showMessage (message) {
                /* Inserts a chat message into the content area of the chat box.
                 *
                 * Will also insert a new day indicator if the message is on a
                 * different day.
                 *
                 * Parameters:
                 *  (Backbone.Model) message: The message object
                 */
                if (!u.isNewMessage(message) && u.isEmptyMessage(message)) {
                    // Handle archived or delayed messages without any message
                    // text to show.
                    return message.destroy();
                }
                const view = new _converse.MessageView({'model': message});
                await view.render();
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
                    } else if (this.model.get('scrolled', true) && !u.isOnlyChatStateNotification(message)) {
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

            setChatState (state, options) {
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
                this.model.set('chat_state', state, options);
                return this;
            },

            async onFormSubmitted (ev) {
                ev.preventDefault();
                const textarea = this.el.querySelector('.chat-textarea'),
                      message = textarea.value;

                if (!message.replace(/\s/g, '').length) {
                    return;
                }
                if (!_converse.connection.authenticated) {
                    this.showHelpMessages(
                        ['Sorry, the connection has been lost, and your message could not be sent'],
                        'error'
                    );
                    return;
                }
                let spoiler_hint, hint_el = {};
                if (this.model.get('composing_spoiler')) {
                    hint_el = this.el.querySelector('form.sendXMPPMessage input.spoiler-hint');
                    spoiler_hint = hint_el.value;
                }
                u.addClass('disabled', textarea);
                textarea.setAttribute('disabled', 'disabled');
                if (this.parseMessageForCommands(message) ||
                    await this.model.sendMessage(this.model.getOutgoingMessageAttributes(message, spoiler_hint))) {

                    hint_el.value = '';
                    textarea.value = '';
                    u.removeClass('correcting', textarea);
                    textarea.style.height = 'auto'; // Fixes weirdness
                    _converse.emit('messageSend', message);
                }
                textarea.removeAttribute('disabled');
                u.removeClass('disabled', textarea);
                textarea.focus();
                // Suppress events, otherwise superfluous CSN gets set
                // immediately after the message, causing rate-limiting issues.
                this.setChatState(_converse.ACTIVE, {'silent': true});
            },

            keyPressed (ev) {
                /* Event handler for when a key is pressed in a chat box textarea.
                 */
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
                        if (this.emoji_dropdown && u.isVisible(this.emoji_dropdown.el.querySelector('.emoji-picker'))) {
                            this.emoji_dropdown.toggle();
                        }
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
                    this.insertIntoTextArea(u.prefixMentions(message), true, true);
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
                const new_height = ev.target.scrollHeight + 'px';
                if (ev.target.style.height !== new_height) {
                    ev.target.style.height = 'auto'; // Fixes weirdness
                    ev.target.style.height = new_height;
                }
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
                    const storage = _converse.config.get('storage'),
                          id = `converse.emoji-${_converse.bare_jid}`;
                    _converse.emojipicker = new _converse.EmojiPicker({'id': id});
                    _converse.emojipicker.browserStorage = new Backbone.BrowserStorage[storage](id);
                    _converse.emojipicker.fetch();
                }
                this.emoji_picker_view = new _converse.EmojiPickerView({
                    'model': _converse.emojipicker
                });
            },

            insertEmoji (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                const target = ev.target.nodeName === 'IMG' ? ev.target.parentElement : ev.target;
                this.insertIntoTextArea(target.getAttribute('data-emoji'));
            },

            toggleEmojiMenu (ev) {
                if (_.isUndefined(this.emoji_dropdown)) {
                    ev.stopPropagation();
                    this.createEmojiPicker();
                    this.insertEmojiPicker();
                    this.renderEmojiPicker();

                    const dropdown_el = this.el.querySelector('.toggle-smiley.dropup');
                    this.emoji_dropdown = new bootstrap.Dropdown(dropdown_el, true);
                    this.emoji_dropdown.el = dropdown_el;
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
                if (state === 'visible') {
                    if (!this.model.isHidden()) {
                        this.setChatState(_converse.ACTIVE);
                        if (this.model.get('num_unread', 0)) {
                            this.model.clearUnreadMsgCounter();
                        }
                    }
                } else if (state === 'hidden') {
                    this.setChatState(_converse.INACTIVE, {'silent': true});
                    this.model.sendChatState();
                }
            }
        });

        _converse.on('chatBoxViewsInitialized', () => {
            const that = _converse.chatboxviews;
            _converse.chatboxes.on('add', item => {
                if (!that.get(item.get('id')) && item.get('type') === _converse.PRIVATE_CHAT_TYPE) {
                    that.add(item.get('id'), new _converse.ChatBoxView({model: item}));
                }
            });
        });

        _converse.on('connected', () => {
            // Advertise that we support XEP-0382 Message Spoilers
            _converse.api.disco.own.features.add(Strophe.NS.SPOILER);
        });

        /************************ BEGIN API ************************/
        _.extend(_converse.api, {
            /**
             * The "chatview" namespace groups methods pertaining to views
             * for one-on-one chats.
             *
             * @namespace _converse.api.chatviews
             * @memberOf _converse.api
             */
            'chatviews': {
                 /**
                  * Get the view of an already open chat.
                  *
                  * @method _converse.api.chatviews.get
                  * @returns {ChatBoxView} A [Backbone.View](http://backbonejs.org/#View) instance.
                  *     The chat should already be open, otherwise `undefined` will be returned.
                  *
                  * @example
                  * // To return a single view, provide the JID of the contact:
                  * _converse.api.chatviews.get('buddy@example.com')
                  *
                  * @example
                  * // To return an array of views, provide an array of JIDs:
                  * _converse.api.chatviews.get(['buddy1@example.com', 'buddy2@example.com'])
                  */
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
