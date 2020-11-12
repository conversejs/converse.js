/**
 * @module converse-muc-views
 * @copyright 2020, the Converse.js contributors
 * @description XEP-0045 Multi-User Chat Views
 * @license Mozilla Public License (MPLv2)
 */
import "./components/muc-sidebar";
import "@converse/headless/utils/muc";
import "converse-modal";
import AddMUCModal from 'modals/add-muc.js';
import MUCInviteModal from 'modals/muc-invite.js';
import MUCListModal from 'modals/muc-list.js';
import ModeratorToolsModal from "./modals/moderator-tools.js";
import RoomDetailsModal from 'modals/muc-details.js';
import log from "@converse/headless/log";
import tpl_chatroom from "templates/chatroom.js";
import tpl_muc_bottom_panel from "templates/muc_bottom_panel.js";
import tpl_muc_destroyed from "templates/muc_destroyed.js";
import tpl_muc_disconnect from "templates/muc_disconnect.js";
import tpl_chatroom_head from "templates/chatroom_head.js";
import tpl_muc_nickname_form from "templates/muc_nickname_form.js";
import tpl_muc_config_form from "templates/muc_config_form.js";
import tpl_muc_password_form from "templates/muc_password_form.js";
import tpl_room_panel from "templates/room_panel.js";
import tpl_spinner from "templates/spinner.js";
import { ChatBoxView } from "./converse-chatview";
import { Model } from '@converse/skeletor/src/model.js';
import { View } from '@converse/skeletor/src/view.js';
import { __ } from './i18n';
import { _converse, api, converse } from "@converse/headless/converse-core";
import { debounce } from "lodash-es";
import { render } from "lit-html";

const { Strophe, sizzle, $pres } = converse.env;
const u = converse.env.utils;

const OWNER_COMMANDS = ['owner'];
const ADMIN_COMMANDS = ['admin', 'ban', 'deop', 'destroy', 'member', 'op', 'revoke'];
const MODERATOR_COMMANDS = ['kick', 'mute', 'voice', 'modtools'];
const VISITOR_COMMANDS = ['nick'];

const COMMAND_TO_ROLE = {
    'deop': 'participant',
    'kick': 'none',
    'mute': 'visitor',
    'op': 'moderator',
    'voice': 'participant'
}
const COMMAND_TO_AFFILIATION = {
    'admin': 'admin',
    'ban': 'outcast',
    'member': 'member',
    'owner': 'owner',
    'revoke': 'none'
}


/**
 * NativeView which renders a groupchat, based upon
 * { @link _converse.ChatBoxView } for normal one-on-one chat boxes.
 * @class
 * @namespace _converse.ChatRoomView
 * @memberOf _converse
 */
export const ChatRoomView = ChatBoxView.extend({
    length: 300,
    tagName: 'div',
    className: 'chatbox chatroom hidden',
    is_chatroom: true,
    events: {
        'click .chatbox-navback': 'showControlBox',
        'click .hide-occupants': 'hideOccupants',
        'click .new-msgs-indicator': 'viewUnreadMessages',
        // Arrow functions don't work here because you can't bind a different `this` param to them.
        'click .occupant-nick': function (ev) {this.insertIntoTextArea(ev.target.textContent) },
        'click .send-button': 'onFormSubmitted',
        'dragover .chat-textarea': 'onDragOver',
        'drop .chat-textarea': 'onDrop',
        'input .chat-textarea': 'inputChanged',
        'keydown .chat-textarea': 'onKeyDown',
        'keyup .chat-textarea': 'onKeyUp',
        'mousedown .dragresize-occupants-left': 'onStartResizeOccupants',
        'paste .chat-textarea': 'onPaste',
        'submit .muc-nickname-form': 'submitNickname',
    },

    async initialize () {
        this.initDebounced();

        this.listenTo(this.model, 'change', debounce(() => this.renderHeading(), 250));
        this.listenTo(this.model, 'change:composing_spoiler', this.renderMessageForm);
        this.listenTo(this.model, 'change:hidden', m => m.get('hidden') ? this.hide() : this.show());
        this.listenTo(this.model, 'change:hidden_occupants', this.onSidebarToggle);
        this.listenTo(this.model, 'configurationNeeded', this.getAndRenderConfigurationForm);
        this.listenTo(this.model, 'destroy', this.hide);
        this.listenTo(this.model, 'show', this.show);
        this.listenTo(this.model.features, 'change:moderated', this.renderBottomPanel);
        this.listenTo(this.model.features, 'change:open', this.renderHeading);
        this.listenTo(this.model.messages, 'rendered', this.maybeScrollDown);
        this.listenTo(this.model.session, 'change:connection_status', this.onConnectionStatusChanged);

        // Bind so that we can pass it to addEventListener and removeEventListener
        this.onMouseMove =  this.onMouseMove.bind(this);
        this.onMouseUp =  this.onMouseUp.bind(this);

        await this.render();

        // Need to be registered after render has been called.
        this.listenTo(this.model, 'change:show_help_messages', this.renderHelpMessages);
        this.listenTo(this.model.messages, 'add', this.onMessageAdded);
        this.listenTo(this.model.messages, 'change', this.renderChatHistory);
        this.listenTo(this.model.messages, 'remove', this.renderChatHistory);
        this.listenTo(this.model.messages, 'reset', this.renderChatHistory);
        this.listenTo(this.model.notifications, 'change', this.renderNotifications);

        this.model.occupants.forEach(o => this.onOccupantAdded(o));
        this.listenTo(this.model.occupants, 'add', this.onOccupantAdded);
        this.listenTo(this.model.occupants, 'change', this.renderChatHistory);
        this.listenTo(this.model.occupants, 'change:affiliation', this.onOccupantAffiliationChanged);
        this.listenTo(this.model.occupants, 'change:role', this.onOccupantRoleChanged);
        this.listenTo(this.model.occupants, 'change:show', this.showJoinOrLeaveNotification);
        this.listenTo(this.model.occupants, 'remove', this.onOccupantRemoved);

        this.renderChatContent();
        this.insertIntoDOM();
        // Register later due to await
        const user_settings = await _converse.api.user.settings.getModel();
        this.listenTo(user_settings, 'change:mucs_with_hidden_subject', this.renderHeading);
        this.onConnectionStatusChanged();
        this.model.maybeShow();
        this.scrollDown();
        /**
         * Triggered once a { @link _converse.ChatRoomView } has been opened
         * @event _converse#chatRoomViewInitialized
         * @type { _converse.ChatRoomView }
         * @example _converse.api.listen.on('chatRoomViewInitialized', view => { ... });
         */
        api.trigger('chatRoomViewInitialized', this);
    },

    async render () {
        const sidebar_hidden = !this.shouldShowSidebar();
        this.el.setAttribute('id', this.model.get('box_id'));
        render(tpl_chatroom({
            sidebar_hidden,
            'model': this.model,
            'occupants': this.model.occupants,
            'show_sidebar': !this.model.get('hidden_occupants') &&
                this.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED,
            'markScrolled': ev => this.markScrolled(ev),
            'muc_show_logs_before_join': api.settings.get('muc_show_logs_before_join'),
            'show_send_button': _converse.show_send_button,
        }), this.el);

        this.notifications = this.el.querySelector('.chat-content__notifications');
        this.content = this.el.querySelector('.chat-content');
        this.msgs_container = this.el.querySelector('.chat-content__messages');
        this.help_container = this.el.querySelector('.chat-content__help');

        this.renderBottomPanel();
        if (!api.settings.get('muc_show_logs_before_join') &&
                this.model.session.get('connection_status') !== converse.ROOMSTATUS.ENTERED) {
            this.showSpinner();
        }
        // Render header as late as possible since it's async and we
        // want the rest of the DOM elements to be available ASAP.
        // Otherwise e.g. this.notifications is not yet defined when accessed elsewhere.
        await this.renderHeading();
        !this.model.get('hidden') && this.show();
    },

    getNotifications () {
        const actors_per_state = this.model.notifications.toJSON();
        const states = api.settings.get('muc_show_join_leave') ?
            [...converse.CHAT_STATES, ...converse.MUC_TRAFFIC_STATES, ...converse.MUC_ROLE_CHANGES] :
            converse.CHAT_STATES;

        return states.reduce((result, state) => {
            const existing_actors = actors_per_state[state];
            if (!(existing_actors?.length)) {
                return result;
            }
            const actors = existing_actors.map(a => this.model.getOccupant(a)?.getDisplayName() || a);
            if (actors.length === 1) {
                if (state === 'composing') {
                    return `${result}${__('%1$s is typing', actors[0])}\n`;
                } else if (state === 'paused') {
                    return `${result}${__('%1$s has stopped typing', actors[0])}\n`;
                } else if (state === _converse.GONE) {
                    return `${result}${__('%1$s has gone away', actors[0])}\n`;
                } else if (state === 'entered') {
                    return `${result}${__('%1$s has entered the groupchat', actors[0])}\n`;
                } else if (state === 'exited') {
                    return `${result}${__('%1$s has left the groupchat', actors[0])}\n`;
                } else if (state === 'op') {
                    return `${result}${__("%1$s is now a moderator", actors[0])}\n`;
                } else if (state === 'deop') {
                    return `${result}${__("%1$s is no longer a moderator", actors[0])}\n`;
                } else if (state === 'voice') {
                    return `${result}${__("%1$s has been given a voice", actors[0])}\n`;
                } else if (state === 'mute') {
                    return `${result}${__("%1$s has been muted", actors[0])}\n`;
                }
            } else if (actors.length > 1) {
                let actors_str;
                if (actors.length > 3) {
                    actors_str = `${Array.from(actors).slice(0, 2).join(', ')} and others`;
                } else {
                    const last_actor = actors.pop();
                    actors_str = __('%1$s and %2$s', actors.join(', '), last_actor);
                }

                if (state === 'composing') {
                    return `${result}${__('%1$s are typing', actors_str)}\n`;
                } else if (state === 'paused') {
                    return `${result}${__('%1$s have stopped typing', actors_str)}\n`;
                } else if (state === _converse.GONE) {
                    return `${result}${__('%1$s have gone away', actors_str)}\n`;
                } else if (state === 'entered') {
                    return `${result}${__('%1$s have entered the groupchat', actors_str)}\n`;
                } else if (state === 'exited') {
                    return `${result}${__('%1$s have left the groupchat', actors_str)}\n`;
                } else if (state === 'op') {
                    return `${result}${__("%1$s are now moderators", actors[0])}\n`;
                } else if (state === 'deop') {
                    return `${result}${__("%1$s are no longer moderators", actors[0])}\n`;
                } else if (state === 'voice') {
                    return `${result}${__("%1$s have been given voices", actors[0])}\n`;
                } else if (state === 'mute') {
                    return `${result}${__("%1$s have been muted", actors[0])}\n`;
                }
            }
            return result;
        }, '');
    },

    getHelpMessages () {
        const setting = api.settings.get("muc_disable_slash_commands");
        const disabled_commands = Array.isArray(setting) ? setting : [];
        return [
            `<strong>/admin</strong>: ${__("Change user's affiliation to admin")}`,
            `<strong>/ban</strong>: ${__('Ban user by changing their affiliation to outcast')}`,
            `<strong>/clear</strong>: ${__('Clear the chat area')}`,
            `<strong>/close</strong>: ${__('Close this groupchat')}`,
            `<strong>/deop</strong>: ${__('Change user role to participant')}`,
            `<strong>/destroy</strong>: ${__('Remove this groupchat')}`,
            `<strong>/help</strong>: ${__('Show this menu')}`,
            `<strong>/kick</strong>: ${__('Kick user from groupchat')}`,
            `<strong>/me</strong>: ${__('Write in 3rd person')}`,
            `<strong>/member</strong>: ${__('Grant membership to a user')}`,
            `<strong>/modtools</strong>: ${__('Opens up the moderator tools GUI')}`,
            `<strong>/mute</strong>: ${__("Remove user's ability to post messages")}`,
            `<strong>/nick</strong>: ${__('Change your nickname')}`,
            `<strong>/op</strong>: ${__('Grant moderator role to user')}`,
            `<strong>/owner</strong>: ${__('Grant ownership of this groupchat')}`,
            `<strong>/register</strong>: ${__("Register your nickname")}`,
            `<strong>/revoke</strong>: ${__("Revoke the user's current affiliation")}`,
            `<strong>/subject</strong>: ${__('Set groupchat subject')}`,
            `<strong>/topic</strong>: ${__('Set groupchat subject (alias for /subject)')}`,
            `<strong>/voice</strong>: ${__('Allow muted user to post messages')}`
            ].filter(line => disabled_commands.every(c => (!line.startsWith(c+'<', 9))))
                .filter(line => this.getAllowedCommands().some(c => line.startsWith(c+'<', 9)));
    },

    /**
     * Renders the MUC heading if any relevant attributes have changed.
     * @private
     * @method _converse.ChatRoomView#renderHeading
     * @param { _converse.ChatRoom } [item]
     */
    async renderHeading () {
        const tpl = await this.generateHeadingTemplate();
        render(tpl, this.el.querySelector('.chat-head-chatroom'));
    },

    renderBottomPanel () {
        const container = this.el.querySelector('.bottom-panel');
        const entered = this.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED;
        const can_edit = entered && !(this.model.features.get('moderated') && this.model.getOwnRole() === 'visitor');
        render(tpl_muc_bottom_panel({ can_edit, entered }), container);
        if (entered && can_edit) {
            this.renderMessageForm();
            this.initMentionAutoComplete();
        }
    },

    onStartResizeOccupants (ev) {
        this.resizing = true;
        this.el.addEventListener('mousemove', this.onMouseMove);
        this.el.addEventListener('mouseup', this.onMouseUp);

        const sidebar_el = this.el.querySelector('converse-muc-sidebar');
        const style = window.getComputedStyle(sidebar_el);
        this.width = parseInt(style.width.replace(/px$/, ''), 10);
        this.prev_pageX = ev.pageX;
    },

    onMouseMove (ev) {
        if (this.resizing) {
            ev.preventDefault();
            const delta = this.prev_pageX - ev.pageX;
            this.resizeSidebarView(delta, ev.pageX);
            this.prev_pageX = ev.pageX;
        }
    },

    onMouseUp (ev) {
        if (this.resizing) {
            ev.preventDefault();
            this.resizing = false;
            this.el.removeEventListener('mousemove', this.onMouseMove);
            this.el.removeEventListener('mouseup', this.onMouseUp);
            const sidebar_el = this.el.querySelector('converse-muc-sidebar');
            const element_position = sidebar_el.getBoundingClientRect();
            const occupants_width = this.calculateSidebarWidth(element_position, 0);
            const attrs = {occupants_width};
            _converse.connection.connected ? this.model.save(attrs) : this.model.set(attrs);
        }
    },

    resizeSidebarView (delta, current_mouse_position) {
        const sidebar_el = this.el.querySelector('converse-muc-sidebar');
        const element_position = sidebar_el.getBoundingClientRect();
        if (this.is_minimum) {
            this.is_minimum = element_position.left < current_mouse_position;
        } else if (this.is_maximum) {
            this.is_maximum = element_position.left > current_mouse_position;
        } else {
            const occupants_width = this.calculateSidebarWidth(element_position, delta);
            sidebar_el.style.flex = "0 0 " + occupants_width + "px";
        }
    },

    calculateSidebarWidth(element_position, delta) {
        let occupants_width = element_position.width + delta;
        const room_width = this.el.clientWidth;
        // keeping display in boundaries
        if (occupants_width < (room_width * 0.20)) {
            // set pixel to 20% width
            occupants_width = (room_width * 0.20);
            this.is_minimum = true;
        } else if (occupants_width > (room_width * 0.75)) {
            // set pixel to 75% width
            occupants_width = (room_width * 0.75);
            this.is_maximum = true;
        } else if ((room_width - occupants_width) < 250) {
            // resize occupants if chat-area becomes smaller than 250px (min-width property set in css)
            occupants_width = room_width - 250;
            this.is_maximum = true;
        } else {
            this.is_maximum = false;
            this.is_minimum = false;
        }
        return occupants_width;
    },

    getAutoCompleteList () {
        return this.model.getAllKnownNicknames().map(nick => ({'label': nick, 'value': `@${nick}`}));
    },

    getAutoCompleteListItem(text, input) {
        input = input.trim();
        const element = document.createElement("li");
        element.setAttribute("aria-selected", "false");

        if (api.settings.get('muc_mention_autocomplete_show_avatar')) {
            const img = document.createElement("img");
            let dataUri = "data:" + _converse.DEFAULT_IMAGE_TYPE + ";base64," + _converse.DEFAULT_IMAGE;

            if (_converse.vcards) {
                const vcard = _converse.vcards.findWhere({'nickname': text});
                if (vcard) dataUri = "data:" + vcard.get('image_type') + ";base64," + vcard.get('image');
            }

            img.setAttribute("src", dataUri);
            img.setAttribute("width", "22");
            img.setAttribute("class", "avatar avatar-autocomplete");
            element.appendChild(img);
        }

        const regex = new RegExp("(" + input + ")", "ig");
        const parts = input ? text.split(regex) : [text];

        parts.forEach(txt => {
            if (input && txt.match(regex)) {
              const match = document.createElement("mark");
              match.textContent = txt;
              element.appendChild(match);
            } else {
              element.appendChild(document.createTextNode(txt));
            }
        });

        return element;
    },

    initMentionAutoComplete () {
        this.mention_auto_complete = new _converse.AutoComplete(this.el, {
            'auto_first': true,
            'auto_evaluate': false,
            'min_chars': api.settings.get('muc_mention_autocomplete_min_chars'),
            'match_current_word': true,
            'list': () => this.getAutoCompleteList(),
            'filter': api.settings.get('muc_mention_autocomplete_filter') == 'contains' ?
                _converse.FILTER_CONTAINS :
                _converse.FILTER_STARTSWITH,
            'ac_triggers': ["Tab", "@"],
            'include_triggers': [],
            'item': this.getAutoCompleteListItem
        });
        this.mention_auto_complete.on('suggestion-box-selectcomplete', () => (this.auto_completing = false));
    },

    /**
     * Get the nickname value from the form and then join the groupchat with it.
     * @private
     * @method _converse.ChatRoomView#submitNickname
     * @param { Event }
     */
    submitNickname (ev) {
        ev.preventDefault();
        const nick = ev.target.nick.value.trim();
        nick && this.model.join(nick);
    },

    onKeyDown (ev) {
        if (this.mention_auto_complete.onKeyDown(ev)) {
            return;
        }
        return _converse.ChatBoxView.prototype.onKeyDown.call(this, ev);
    },

    onKeyUp (ev) {
        this.mention_auto_complete.evaluate(ev);
        return _converse.ChatBoxView.prototype.onKeyUp.call(this, ev);
    },

    async onMessageRetractButtonClicked (message) {
        const retraction_warning =
            __("Be aware that other XMPP/Jabber clients (and servers) may "+
                "not yet support retractions and that this message may not "+
                "be removed everywhere.");

        if (message.mayBeRetracted()) {
            const messages = [__('Are you sure you want to retract this message?')];
            if (api.settings.get('show_retraction_warning')) {
                messages[1] = retraction_warning;
            }
            !!(await api.confirm(__('Confirm'), messages)) && this.model.retractOwnMessage(message);
        } else if (await message.mayBeModerated()) {
            if (message.get('sender') === 'me') {
                let messages = [__('Are you sure you want to retract this message?')];
                if (api.settings.get('show_retraction_warning')) {
                    messages = [messages[0], retraction_warning, messages[1]]
                }
                !!(await api.confirm(__('Confirm'), messages)) && this.retractOtherMessage(message);
            } else {
                let messages = [
                    __('You are about to retract this message.'),
                    __('You may optionally include a message, explaining the reason for the retraction.')
                ];
                if (api.settings.get('show_retraction_warning')) {
                    messages = [messages[0], retraction_warning, messages[1]]
                }
                const reason = await api.prompt(
                    __('Message Retraction'),
                    messages,
                    __('Optional reason')
                );
                (reason !== false) && this.retractOtherMessage(message, reason);
            }
        } else {
            const err_msg = __(`Sorry, you're not allowed to retract this message`);
            api.alert('error', __('Error'), err_msg);
        }
    },

    /**
     * Retract someone else's message in this groupchat.
     * @private
     * @method _converse.ChatRoomView#retractOtherMessage
     * @param { _converse.Message } message - The message which we're retracting.
     * @param { string } [reason] - The reason for retracting the message.
     */
    async retractOtherMessage (message, reason) {
        const result = await this.model.retractOtherMessage(message, reason);
        if (result === null) {
            const err_msg = __(`A timeout occurred while trying to retract the message`);
            api.alert('error', __('Error'), err_msg);
            log(err_msg, Strophe.LogLevel.WARN);
        } else if (u.isErrorStanza(result)) {
            const err_msg = __(`Sorry, you're not allowed to retract this message.`);
            api.alert('error', __('Error'), err_msg);
            log(err_msg, Strophe.LogLevel.WARN);
            log(result, Strophe.LogLevel.WARN);
        }
    },

    showModeratorToolsModal (affiliation) {
        if (!this.verifyRoles(['moderator'])) {
            return;
        }
        if (typeof this.model.modtools_modal === 'undefined') {
            const model = new Model({'affiliation': affiliation});
            this.modtools_modal = new ModeratorToolsModal({model, _converse, 'chatroomview': this});
        } else {
            this.modtools_modal.set('affiliation', affiliation);
        }
        this.modtools_modal.show();
    },

    showRoomDetailsModal (ev) {
        ev.preventDefault();
        if (this.model.room_details_modal === undefined) {
            this.model.room_details_modal = new RoomDetailsModal({'model': this.model});
        }
        this.model.room_details_modal.show(ev);
    },

    showChatStateNotification (message) {
        if (message.get('sender') === 'me') {
            return;
        }
        return _converse.ChatBoxView.prototype.showChatStateNotification.apply(this, arguments);
    },

    shouldShowSidebar () {
        return !this.model.get('hidden_occupants') &&
            this.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED;
    },

    onSidebarToggle () {
        this.renderToolbar();
        this.el.querySelector('.occupants')?.setVisibility();
    },

    onOccupantAffiliationChanged (occupant) {
        if (occupant.get('jid') === _converse.bare_jid) {
            this.renderHeading();
        }
    },

    onOccupantRoleChanged (occupant) {
        if (occupant.get('jid') === _converse.bare_jid) {
            this.renderBottomPanel();
        }
    },

    /**
     * Returns a list of objects which represent buttons for the groupchat header.
     * @emits _converse#getHeadingButtons
     * @private
     * @method _converse.ChatRoomView#getHeadingButtons
     */
    getHeadingButtons (subject_hidden) {
        const buttons = [];
        buttons.push({
            'i18n_text': __('Details'),
            'i18n_title': __('Show more information about this groupchat'),
            'handler': ev => this.showRoomDetailsModal(ev),
            'a_class': 'show-room-details-modal',
            'icon_class': 'fa-info-circle',
            'name': 'details'
        });

        if (this.model.getOwnAffiliation() === 'owner') {
            buttons.push({
                'i18n_text': __('Configure'),
                'i18n_title': __('Configure this groupchat'),
                'handler': ev => this.getAndRenderConfigurationForm(ev),
                'a_class': 'configure-chatroom-button',
                'icon_class': 'fa-wrench',
                'name': 'configure'
            });
        }

        if (this.model.invitesAllowed()) {
            buttons.push({
                'i18n_text': __('Invite'),
                'i18n_title': __('Invite someone to join this groupchat'),
                'handler': ev => this.showInviteModal(ev),
                'a_class': 'open-invite-modal',
                'icon_class': 'fa-user-plus',
                'name': 'invite'
            });
        }

        const subject = this.model.get('subject');
        if (subject && subject.text) {
            buttons.push({
                'i18n_text': subject_hidden ? __('Show topic') : __('Hide topic'),
                'i18n_title': subject_hidden ?
                    __('Show the topic message in the heading') :
                    __('Hide the topic in the heading'),
                'handler': ev => this.toggleTopic(ev),
                'a_class': 'hide-topic',
                'icon_class': 'fa-minus-square',
                'name': 'toggle-topic'
            });
        }


        const conn_status = this.model.session.get('connection_status');
        if (conn_status === converse.ROOMSTATUS.ENTERED) {
            const allowed_commands = this.getAllowedCommands();
            if (allowed_commands.includes('modtools')) {
                buttons.push({
                    'i18n_text': __('Moderate'),
                    'i18n_title': __('Moderate this groupchat'),
                    'handler': () => this.showModeratorToolsModal(),
                    'a_class': 'moderate-chatroom-button',
                    'icon_class': 'fa-user-cog',
                    'name': 'moderate'
                });
            }
            if (allowed_commands.includes('destroy')) {
                buttons.push({
                    'i18n_text': __('Destroy'),
                    'i18n_title': __('Remove this groupchat'),
                    'handler': ev => this.destroy(ev),
                    'a_class': 'destroy-chatroom-button',
                    'icon_class': 'fa-trash',
                    'name': 'destroy'
                });
            }
        }

        if (!api.settings.get("singleton")) {
            buttons.push({
                'i18n_text': __('Leave'),
                'i18n_title': __('Leave and close this groupchat'),
                'handler': async ev => {
                    ev.stopPropagation();
                    const messages = [__('Are you sure you want to leave this groupchat?')];
                    const result = await api.confirm(__('Confirm'), messages);
                    result && this.close(ev);
                },
                'a_class': 'close-chatbox-button',
                'standalone': api.settings.get("view_mode") === 'overlayed',
                'icon_class': 'fa-sign-out-alt',
                'name': 'signout'
            });
        }
        return _converse.api.hook('getHeadingButtons', this, buttons);
    },

    /**
     * Returns the groupchat heading TemplateResult to be rendered.
     * @private
     * @method _converse.ChatRoomView#generateHeadingTemplate
     */
    async generateHeadingTemplate () {
        const subject_hidden = await this.model.isSubjectHidden();
        const heading_btns = await this.getHeadingButtons(subject_hidden);
        const standalone_btns = heading_btns.filter(b => b.standalone);
        const dropdown_btns = heading_btns.filter(b => !b.standalone);
        return tpl_chatroom_head(
            Object.assign(this.model.toJSON(), {
                _converse,
                subject_hidden,
                'dropdown_btns': dropdown_btns.map(b => this.getHeadingDropdownItem(b)),
                'standalone_btns': standalone_btns.map(b => this.getHeadingStandaloneButton(b)),
                'title': this.model.getDisplayName(),
        }));
    },

    toggleTopic () {
        this.model.toggleSubjectHiddenState();
    },

    showInviteModal (ev) {
        ev.preventDefault();
        if (this.muc_invite_modal === undefined) {
            this.muc_invite_modal = new MUCInviteModal({'model': new Model()});
            // TODO: remove once we have API for sending direct invite
            this.muc_invite_modal.chatroomview = this;
        }
        this.muc_invite_modal.show(ev);
    },


    /**
     * Callback method that gets called after the chat has become visible.
     * @private
     * @method _converse.ChatRoomView#afterShown
     */
    afterShown () {
        // Override from converse-chatview, specifically to avoid
        // the 'active' chat state from being sent out prematurely.
        // This is instead done in `onConnectionStatusChanged` below.
        if (u.isPersistableModel(this.model)) {
            this.model.clearUnreadMsgCounter();
        }
        this.scrollDown();
    },

    onConnectionStatusChanged () {
        const conn_status = this.model.session.get('connection_status');
        if (conn_status === converse.ROOMSTATUS.NICKNAME_REQUIRED) {
            this.renderNicknameForm();
        } else if (conn_status === converse.ROOMSTATUS.PASSWORD_REQUIRED) {
            this.renderPasswordForm();
        } else if (conn_status === converse.ROOMSTATUS.CONNECTING) {
            this.showSpinner();
        } else if (conn_status === converse.ROOMSTATUS.ENTERED) {
            this.renderBottomPanel();
            this.hideSpinner();
            this.maybeFocus();
        } else if (conn_status === converse.ROOMSTATUS.DISCONNECTED) {
            this.showDisconnectMessage();
        } else if (conn_status === converse.ROOMSTATUS.DESTROYED) {
            this.showDestroyedMessage();
        }
    },

    getToolbarOptions () {
        return Object.assign(
            _converse.ChatBoxView.prototype.getToolbarOptions.apply(this, arguments), {
                'is_groupchat': true,
                'label_hide_occupants': __('Hide the list of participants'),
                'show_occupants_toggle': _converse.visible_toolbar_buttons.toggle_occupants
            }
        );
    },

    /**
     * Closes this chat box, which implies leaving the groupchat as well.
     * @private
     * @method _converse.ChatRoomView#close
     */
    async close () {
        this.hide();
        if (_converse.router.history.getFragment() === "converse/room?jid="+this.model.get('jid')) {
            _converse.router.navigate('');
        }
        await this.model.leave();
        return _converse.ChatBoxView.prototype.close.apply(this, arguments);
    },

    /**
     * Hide the right sidebar containing the chat occupants.
     * @private
     * @method _converse.ChatRoomView#hideOccupants
     */
    hideOccupants (ev) {
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
        this.model.save({'hidden_occupants': true});
        this.scrollDown();
    },

    verifyRoles (roles, occupant, show_error=true) {
        if (!Array.isArray(roles)) {
            throw new TypeError('roles must be an Array');
        }
        if (!roles.length) {
            return true;
        }
        occupant = occupant || this.model.occupants.findWhere({'jid': _converse.bare_jid});
        if (occupant) {
            const role = occupant.get('role');
            if (roles.includes(role)) {
                return true;
            }
        }
        if (show_error) {
            const message = __('Forbidden: you do not have the necessary role in order to do that.');
            this.model.createMessage({message, 'type': 'error'});
        }
        return false;
    },

    verifyAffiliations (affiliations, occupant, show_error=true) {
        if (!Array.isArray(affiliations)) {
            throw new TypeError('affiliations must be an Array');
        }
        if (!affiliations.length) {
            return true;
        }
        occupant = occupant || this.model.occupants.findWhere({'jid': _converse.bare_jid});
        if (occupant) {
            const a = occupant.get('affiliation');
            if (affiliations.includes(a)) {
                return true;
            }
        }
        if (show_error) {
            const message = __('Forbidden: you do not have the necessary affiliation in order to do that.');
            this.model.createMessage({message, 'type': 'error'});
        }
        return false;
    },

    validateRoleOrAffiliationChangeArgs (command, args) {
        if (!args) {
            const message = __(
                'Error: the "%1$s" command takes two arguments, the user\'s nickname and optionally a reason.',
                command
            );
            this.model.createMessage({message, 'type': 'error'});
            return false;
        }
        return true;
    },

    getNickOrJIDFromCommandArgs (args) {
        if (u.isValidJID(args.trim())) {
            return args.trim();
        }
        if (!args.startsWith('@')) {
            args = '@'+ args;
        }
        const [text, references] = this.model.parseTextForReferences(args); // eslint-disable-line no-unused-vars
        if (!references.length) {
            const message = __("Error: couldn't find a groupchat participant based on your arguments");
            this.model.createMessage({message, 'type': 'error'});
            return;
        }
        if (references.length > 1) {
            const message = __("Error: found multiple groupchat participant based on your arguments");
            this.model.createMessage({message, 'type': 'error'});
            return;
        }
        const nick_or_jid = references.pop().value;
        const reason = args.split(nick_or_jid, 2)[1];
        if (reason && !reason.startsWith(' ')) {
            const message = __("Error: couldn't find a groupchat participant based on your arguments");
            this.model.createMessage({message, 'type': 'error'});
            return;
        }
        return nick_or_jid;
    },

    setAffiliation (command, args, required_affiliations) {
        const affiliation = COMMAND_TO_AFFILIATION[command];
        if (!affiliation) {
            throw Error(`ChatRoomView#setAffiliation called with invalid command: ${command}`);
        }
        if (!this.verifyAffiliations(required_affiliations)) {
            return false;
        }
        if (!this.validateRoleOrAffiliationChangeArgs(command, args)) {
            return false;
        }
        const nick_or_jid = this.getNickOrJIDFromCommandArgs(args);
        if (!nick_or_jid) {
            return false;
        }

        let jid;
        const reason = args.split(nick_or_jid, 2)[1].trim();
        const occupant = this.model.getOccupant(nick_or_jid);
        if (occupant) {
            jid = occupant.get('jid');
        } else {
            if (u.isValidJID(nick_or_jid)) {
                jid = nick_or_jid;
            } else {
                const message = __(
                    "Couldn't find a participant with that nickname. "+
                    "They might have left the groupchat."
                );
                this.model.createMessage({message, 'type': 'error'});
                return;
            }
        }
        const attrs = { jid, reason };
        if (occupant && api.settings.get('auto_register_muc_nickname')) {
            attrs['nick'] = occupant.get('nick');
        }
        this.model.setAffiliation(affiliation, [attrs])
            .then(() => this.model.occupants.fetchMembers())
            .catch(err => this.onCommandError(err));
    },

    getReason (args) {
        return args.includes(',') ? args.slice(args.indexOf(',')+1).trim() : null;
    },

    setRole (command, args, required_affiliations=[], required_roles=[]) {
        /* Check that a command to change a groupchat user's role or
         * affiliation has anough arguments.
         */
        const role = COMMAND_TO_ROLE[command];
        if (!role) {
            throw Error(`ChatRoomView#setRole called with invalid command: ${command}`);
        }
        if (!this.verifyAffiliations(required_affiliations) || !this.verifyRoles(required_roles)) {
            return false;
        }
        if (!this.validateRoleOrAffiliationChangeArgs(command, args)) {
            return false;
        }
        const nick_or_jid = this.getNickOrJIDFromCommandArgs(args);
        if (!nick_or_jid) {
            return false;
        }
        const reason = args.split(nick_or_jid, 2)[1].trim();
        // We're guaranteed to have an occupant due to getNickOrJIDFromCommandArgs
        const occupant = this.model.getOccupant(nick_or_jid);
        this.model.setRole(occupant, role, reason, undefined, this.onCommandError.bind(this));
        return true;
    },

    onCommandError (err) {
        log.fatal(err);
        const message =
            __("Sorry, an error happened while running the command.") + " " +
            __("Check your browser's developer console for details.");
        this.model.createMessage({message, 'type': 'error'});
    },

    getAllowedCommands () {
        let allowed_commands = ['clear', 'help', 'me', 'nick', 'register'];
        if (this.model.config.get('changesubject') || ['owner', 'admin'].includes(this.model.getOwnAffiliation())) {
            allowed_commands = [...allowed_commands, ...['subject', 'topic']];
        }
        const occupant = this.model.occupants.findWhere({'jid': _converse.bare_jid});
        if (this.verifyAffiliations(['owner'], occupant, false)) {
            allowed_commands = allowed_commands.concat(OWNER_COMMANDS).concat(ADMIN_COMMANDS);
        } else if (this.verifyAffiliations(['admin'], occupant, false)) {
            allowed_commands = allowed_commands.concat(ADMIN_COMMANDS);
        }
        if (this.verifyRoles(['moderator'], occupant, false)) {
            allowed_commands = allowed_commands.concat(MODERATOR_COMMANDS).concat(VISITOR_COMMANDS);
        } else if (!this.verifyRoles(['visitor', 'participant', 'moderator'], occupant, false)) {
            allowed_commands = allowed_commands.concat(VISITOR_COMMANDS);
        }
        allowed_commands.sort();

        if (Array.isArray(api.settings.get('muc_disable_slash_commands'))) {
            return allowed_commands.filter(c => !api.settings.get('muc_disable_slash_commands').includes(c));
        } else {
            return allowed_commands;
        }
    },

    async destroy () {
        const messages = [__('Are you sure you want to destroy this groupchat?')];
        let fields = [{
            'name': 'challenge',
            'label': __('Please enter the XMPP address of this groupchat to confirm'),
            'challenge': this.model.get('jid'),
            'placeholder': __('name@example.org'),
            'required': true
        }, {
            'name': 'reason',
            'label': __('Optional reason for destroying this groupchat'),
            'placeholder': __('Reason')
        }, {
            'name': 'newjid',
            'label': __('Optional XMPP address for a new groupchat that replaces this one'),
            'placeholder': __('replacement@example.org')
        }];
        try {
            fields = await api.confirm(__('Confirm'), messages, fields);
            const reason = fields.filter(f => f.name === 'reason').pop()?.value;
            const newjid = fields.filter(f => f.name === 'newjid').pop()?.value;
            return this.model.sendDestroyIQ(reason, newjid).then(() => this.close())
        } catch (e) {
            log.error(e);
        }
    },

    parseMessageForCommands (text) {
        if (api.settings.get('muc_disable_slash_commands') &&
                !Array.isArray(api.settings.get('muc_disable_slash_commands'))) {
            return _converse.ChatBoxView.prototype.parseMessageForCommands.apply(this, arguments);
        }
        text = text.replace(/^\s*/, "");
        const command = (text.match(/^\/([a-zA-Z]*) ?/) || ['']).pop().toLowerCase();
        if (!command) {
            return false;
        }
        const args = text.slice(('/'+command).length+1).trim();
        if (!this.getAllowedCommands().includes(command)) {
            return false;
        }

        switch (command) {
            case 'admin': {
                this.setAffiliation(command, args, ['owner']);
                break;
            }
            case 'ban': {
                this.setAffiliation(command, args, ['admin', 'owner']);
                break;
            }
            case 'modtools': {
                this.showModeratorToolsModal(args);
                break;
            }
            case 'deop': {
                // FIXME: /deop only applies to setting a moderators
                // role to "participant" (which only admin/owner can
                // do). Moderators can however set non-moderator's role
                // to participant (e.g. visitor => participant).
                // Currently we don't distinguish between these two
                // cases.
                this.setRole(command, args, ['admin', 'owner']);
                break;
            }
            case 'destroy': {
                if (!this.verifyAffiliations(['owner'])) {
                    break;
                }
                this.destroy().catch(e => this.onCommandError(e));
                break;
            }
            case 'help': {
                this.model.set({'show_help_messages': true});
                break;
            } case 'kick': {
                this.setRole(command, args, [], ['moderator']);
                break;
            }
            case 'mute': {
                this.setRole(command, args, [], ['moderator']);
                break;
            }
            case 'member': {
                this.setAffiliation(command, args, ['admin', 'owner']);
                break;
            }
            case 'nick': {
                if (!this.verifyRoles(['visitor', 'participant', 'moderator'])) {
                    break;
                } else if (args.length === 0) {
                    // e.g. Your nickname is "coolguy69"
                    const message = __('Your nickname is "%1$s"', this.model.get('nick'));
                    this.model.createMessage({message, 'type': 'error'});

                } else {
                    const jid = Strophe.getBareJidFromJid(this.model.get('jid'));
                    api.send($pres({
                        from: _converse.connection.jid,
                        to: `${jid}/${args}`,
                        id: u.getUniqueId()
                    }).tree());
                }
                break;
            }
            case 'owner':
                this.setAffiliation(command, args, ['owner']);
                break;
            case 'op': {
                this.setRole(command, args, ['admin', 'owner']);
                break;
            }
            case 'register': {
                if (args.length > 1) {
                    this.model.createMessage({
                        'message': __('Error: invalid number of arguments'),
                        'type': 'error'
                    });
                } else {
                    this.model.registerNickname().then(err_msg => {
                        err_msg && this.model.createMessage({'message': err_msg, 'type': 'error'});
                    });
                }
                break;
            }
            case 'revoke': {
                this.setAffiliation(command, args, ['admin', 'owner']);
                break;
            }
            case 'topic':
            case 'subject':
                this.model.setSubject(args);
                break;
            case 'voice': {
                this.setRole(command, args, [], ['moderator']);
                break;
            }
            default:
                return _converse.ChatBoxView.prototype.parseMessageForCommands.apply(this, arguments);
        }
        return true;
    },

    /**
     * Renders a form given an IQ stanza containing the current
     * groupchat configuration.
     * Returns a promise which resolves once the user has
     * either submitted the form, or canceled it.
     * @private
     * @method _converse.ChatRoomView#renderConfigurationForm
     * @param { XMLElement } stanza: The IQ stanza containing the groupchat config.
     */
    renderConfigurationForm (stanza) {
        this.hideChatRoomContents();
        this.model.save('config_stanza', stanza.outerHTML);
        if (!this.config_form) {
            this.config_form = new _converse.MUCConfigForm({
                'model': this.model,
                'chatroomview': this
            });
            const container_el = this.el.querySelector('.chatroom-body');
            container_el.insertAdjacentElement('beforeend', this.config_form.el);
        }
        u.showElement(this.config_form.el);
    },

    /**
     * Renders a form which allows the user to choose theirnickname.
     * @private
     * @method _converse.ChatRoomView#renderNicknameForm
     */
    renderNicknameForm () {
        const tpl_result = tpl_muc_nickname_form(this.model.toJSON());
        if (api.settings.get('muc_show_logs_before_join')) {
            const container = this.el.querySelector('.muc-bottom-panel');
            render(tpl_result, container);
            u.addClass('muc-bottom-panel--nickname', container);
        } else {
            const form = this.el.querySelector('.muc-nickname-form');
            const form_el = u.getElementFromTemplateResult(tpl_result);
            if (form) {
                sizzle('.spinner', this.el).forEach(u.removeElement);
                form.outerHTML = form_el.outerHTML;
            } else {
                this.hideChatRoomContents();
                const container = this.el.querySelector('.chatroom-body');
                container.insertAdjacentElement('beforeend', form_el);
            }
        }
        u.safeSave(this.model.session, {'connection_status': converse.ROOMSTATUS.NICKNAME_REQUIRED});
    },

    /**
     * Remove the configuration form without submitting and return to the chat view.
     * @private
     * @method _converse.ChatRoomView#closeForm
     */
    closeForm () {
        sizzle('.chatroom-form-container', this.el).forEach(e => u.addClass('hidden', e));
        this.renderAfterTransition();
    },

    /**
     * Start the process of configuring a groupchat, either by
     * rendering a configuration form, or by auto-configuring
     * based on the "roomconfig" data stored on the
     * {@link _converse.ChatRoom}.
     * Stores the new configuration on the {@link _converse.ChatRoom}
     * once completed.
     * @private
     * @method _converse.ChatRoomView#getAndRenderConfigurationForm
     * @param { Event } ev - DOM event that might be passed in if this
     *   method is called due to a user action. In this
     *   case, auto-configure won't happen, regardless of
     *   the settings.
     */
    getAndRenderConfigurationForm () {
        if (!this.config_form || !u.isVisible(this.config_form.el)) {
            this.showSpinner();
            this.model.fetchRoomConfiguration()
                .then(iq => this.renderConfigurationForm(iq))
                .catch(e => log.error(e));
        } else {
            this.closeForm();
        }
    },

    hideChatRoomContents () {
        const container_el = this.el.querySelector('.chatroom-body');
        if (container_el !== null) {
            [].forEach.call(container_el.children, child => child.classList.add('hidden'));
        }
    },

    renderPasswordForm () {
        this.hideChatRoomContents();
        const message = this.model.get('password_validation_message');
        this.model.save('password_validation_message', undefined);

        if (!this.password_form) {
            this.password_form = new _converse.MUCPasswordForm({
                'model': new Model({
                    'validation_message': message
                }),
                'chatroomview': this,
            });
            const container_el = this.el.querySelector('.chatroom-body');
            container_el.insertAdjacentElement('beforeend', this.password_form.el);
        } else {
            this.password_form.model.set('validation_message', message);
        }
        u.showElement(this.password_form.el);
        this.model.session.save('connection_status', converse.ROOMSTATUS.PASSWORD_REQUIRED);
    },

    showDestroyedMessage () {
        u.hideElement(this.el.querySelector('.chat-area'));
        u.hideElement(this.el.querySelector('.occupants'));
        sizzle('.spinner', this.el).forEach(u.removeElement);

        const reason = this.model.get('destroyed_reason');
        const moved_jid = this.model.get('moved_jid');
        this.model.save({
            'destroyed_reason': undefined,
            'moved_jid': undefined
        });
        const container = this.el.querySelector('.disconnect-container');
        render(tpl_muc_destroyed(moved_jid, reason), container);
        const switch_el = container.querySelector('a.switch-chat');
        if (switch_el) {
            switch_el.addEventListener('click', async ev => {
                ev.preventDefault();
                const room = await api.rooms.get(moved_jid, null, true);
                room.maybeShow(true);
                this.model.destroy();
            });
        }
        u.showElement(container);
    },

    showDisconnectMessage () {
        const message = this.model.get('disconnection_message');
        if (!message) {
            return;
        }
        u.hideElement(this.el.querySelector('.chat-area'));
        u.hideElement(this.el.querySelector('.occupants'));
        sizzle('.spinner', this.el).forEach(u.removeElement);

        const messages = [message];
        const actor = this.model.get('disconnection_actor');
        if (actor) {
            messages.push(__('This action was done by %1$s.', actor));
        }
        const reason = this.model.get('disconnection_reason');
        if (reason) {
            messages.push(__('The reason given is: "%1$s".', reason));
        }
        this.model.save({
            'disconnection_message': undefined,
            'disconnection_reason': undefined,
            'disconnection_actor': undefined
        });
        const container = this.el.querySelector('.disconnect-container');
        render(tpl_muc_disconnect(messages), container);
        u.showElement(container);
    },

    onOccupantAdded (occupant) {
        if (occupant.get('jid') === _converse.bare_jid) {
            this.renderHeading();
            this.renderBottomPanel();
        }
    },

    /**
     * Working backwards, get today's most recent join/leave notification
     * from the same user (if any exists) after the most recent chat message.
     * @private
     * @method _converse.ChatRoomView#getPreviousJoinOrLeaveNotification
     * @param {HTMLElement} el
     * @param {string} nick
     */
    getPreviousJoinOrLeaveNotification (el, nick) {
        const today = (new Date()).toISOString().split('T')[0];
        while (el !== null) {
            if (!el.classList.contains('chat-info')) {
                return;
            }
            // Check whether el is still from today.
            // We don't use `Dayjs.same` here, since it's about 4 times slower.
            const date = el.getAttribute('data-isodate');
            if (date && date.split('T')[0] !== today) {
                return;
            }
            const data = el?.dataset || {};
            if (data.join === nick ||
                    data.leave === nick ||
                    data.leavejoin === nick ||
                    data.joinleave === nick) {
                return el;
            }
            el = el.previousElementSibling;
        }
    },

    /**
     * Rerender the groupchat after some kind of transition. For
     * example after the spinner has been removed or after a
     * form has been submitted and removed.
     * @private
     * @method _converse.ChatRoomView#renderAfterTransition
     */
    renderAfterTransition () {
        const conn_status = this.model.session.get('connection_status')
        if (conn_status == converse.ROOMSTATUS.NICKNAME_REQUIRED) {
            this.renderNicknameForm();
        } else if (conn_status == converse.ROOMSTATUS.PASSWORD_REQUIRED) {
            this.renderPasswordForm();
        } else if (conn_status == converse.ROOMSTATUS.ENTERED) {
            this.hideChatRoomContents();
            u.showElement(this.el.querySelector('.chat-area'));
            this.el.querySelector('.occupants')?.setVisibility();
            this.scrollDown();
        }
    },

    showSpinner () {
        sizzle('.spinner', this.el).forEach(u.removeElement);
        this.hideChatRoomContents();
        const container_el = this.el.querySelector('.chatroom-body');
        container_el.insertAdjacentElement(
            'afterbegin',
            u.getElementFromTemplateResult(tpl_spinner())
        );
    },

    /**
     * Check if the spinner is being shown and if so, hide it.
     * Also make sure then that the chat area and occupants
     * list are both visible.
     * @private
     * @method _converse.ChatRoomView#hideSpinner
     */
    hideSpinner () {
        const spinner = this.el.querySelector('.spinner');
        if (spinner !== null) {
            u.removeElement(spinner);
            this.renderAfterTransition();
        }
        return this;
    }
});


/**
 * View which renders MUC section of the control box.
 * @class
 * @namespace _converse.RoomsPanel
 * @memberOf _converse
 */
export const RoomsPanel = View.extend({
    tagName: 'div',
    className: 'controlbox-section',
    id: 'chatrooms',
    events: {
        'click a.controlbox-heading__btn.show-add-muc-modal': 'showAddRoomModal',
        'click a.controlbox-heading__btn.show-list-muc-modal': 'showMUCListModal'
    },

    toHTML () {
        return tpl_room_panel({
            'heading_chatrooms': __('Groupchats'),
            'title_new_room': __('Add a new groupchat'),
            'title_list_rooms': __('Query for groupchats')
        });
    },

    showAddRoomModal (ev) {
        if (this.add_room_modal === undefined) {
            this.add_room_modal = new AddMUCModal({'model': this.model});
        }
        this.add_room_modal.show(ev);
    },

    showMUCListModal(ev) {
        if (this.muc_list_modal === undefined) {
            this.muc_list_modal = new MUCListModal({'model': this.model});
        }
        this.muc_list_modal.show(ev);
    }
});


converse.plugins.add('converse-muc-views', {
    /* Dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin. They are "optional" because they might not be
     * available, in which case any overrides applicable to them will be
     * ignored.
     *
     * NB: These plugins need to have already been loaded via require.js.
     *
     * It's possible to make these dependencies "non-optional".
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found.
     */
    dependencies: ["converse-autocomplete", "converse-modal", "converse-controlbox", "converse-chatview"],

    overrides: {
        ControlBoxView: {
            renderControlBoxPane () {
                this.__super__.renderControlBoxPane.apply(this, arguments);
                if (api.settings.get('allow_muc')) {
                    this.renderRoomsPanel();
                }
            }
        }
    },

    initialize () {
        const { _converse } = this;

        api.promises.add(['roomsPanelRendered']);

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({
            'auto_list_rooms': false,
            'cache_muc_messages': true,
            'locked_muc_nickname': false,
            'modtools_disable_query': [],
            'modtools_disable_assign': false,
            'muc_disable_slash_commands': false,
            'muc_mention_autocomplete_filter': 'contains',
            'muc_mention_autocomplete_min_chars': 0,
            'muc_mention_autocomplete_show_avatar': true,
            'muc_roomid_policy': null,
            'muc_roomid_policy_hint': null,
            'roomconfig_whitelist': [],
            'show_retraction_warning': true,
            'visible_toolbar_buttons': {
                'toggle_occupants': true
            }
        });


        _converse.ChatRoomView = ChatRoomView;
        _converse.RoomsPanel = RoomsPanel;


        const viewWithRoomsPanel = {
            renderRoomsPanel () {
                if (this.roomspanel && u.isInDOM(this.roomspanel.el)) {
                    return this.roomspanel;
                }
                const id = `converse.roomspanel${_converse.bare_jid}`;

                this.roomspanel = new _converse.RoomsPanel({
                    'model': new (_converse.RoomsPanelModel.extend({
                        id,
                        'browserStorage': _converse.createStore(id)
                    }))()
                });
                this.roomspanel.model.fetch();
                this.el.querySelector('.controlbox-pane').insertAdjacentElement(
                    'beforeEnd', this.roomspanel.render().el);

                /**
                 * Triggered once the section of the { @link _converse.ControlBoxView }
                 * which shows gropuchats has been rendered.
                 * @event _converse#roomsPanelRendered
                 * @example _converse.api.listen.on('roomsPanelRendered', () => { ... });
                 */
                api.trigger('roomsPanelRendered');
                return this.roomspanel;
            },

            getRoomsPanel () {
                if (this.roomspanel && u.isInDOM(this.roomspanel.el)) {
                    return this.roomspanel;
                } else {
                    return this.renderRoomsPanel();
                }
            }
        }

        if (_converse.ControlBoxView) {
            Object.assign(_converse.ControlBoxView.prototype, viewWithRoomsPanel);
        }


        _converse.MUCConfigForm = View.extend({
            className: 'chatroom-form-container muc-config-form',

            initialize (attrs) {
                this.chatroomview = attrs.chatroomview;
                this.listenTo(this.chatroomview.model.features, 'change:passwordprotected', this.render);
                this.listenTo(this.chatroomview.model.features, 'change:config_stanza', this.render);
                this.render();
            },

            toHTML () {
                const stanza = u.toStanza(this.model.get('config_stanza'));
                const whitelist = api.settings.get('roomconfig_whitelist');
                let fields = sizzle('field', stanza);
                if (whitelist.length) {
                    fields = fields.filter(f => whitelist.includes(f.getAttribute('var')));
                }
                const password_protected = this.model.features.get('passwordprotected');
                const options = {
                    'new_password': !password_protected,
                    'fixed_username': this.model.get('jid')
                };
                return tpl_muc_config_form({
                    'closeConfigForm': ev => this.closeConfigForm(ev),
                    'fields': fields.map(f => u.xForm2webForm(f, stanza, options)),
                    'instructions': stanza.querySelector('instructions')?.textContent,
                    'submitConfigForm': ev => this.submitConfigForm(ev),
                    'title': stanza.querySelector('title')?.textContent
                });
            },

            async submitConfigForm (ev) {
                ev.preventDefault();
                const inputs = sizzle(':input:not([type=button]):not([type=submit])', ev.target);
                const config_array = inputs.map(u.webForm2xForm).filter(f => f);
                try {
                    await this.model.sendConfiguration(config_array);
                } catch (e) {
                    log.error(e);
                    const message =
                        __("Sorry, an error occurred while trying to submit the config form.") + " " +
                        __("Check your browser's developer console for details.");
                    api.alert('error', __('Error'), message);
                }
                await this.model.refreshDiscoInfo();
                this.chatroomview.closeForm();
            },

            closeConfigForm (ev) {
                ev.preventDefault();
                this.chatroomview.closeForm();
            }
        });


        _converse.MUCPasswordForm = View.extend({
            className: 'chatroom-form-container muc-password-form',

            initialize (attrs) {
                this.chatroomview = attrs.chatroomview;
                this.listenTo(this.model, 'change:validation_message', this.render);
                this.render();
            },

            toHTML () {
                return tpl_muc_password_form({
                    'jid': this.model.get('jid'),
                    'submitPassword': ev => this.submitPassword(ev),
                    'validation_message':  this.model.get('validation_message')
                });
            },

            submitPassword (ev) {
                ev.preventDefault();
                const password = this.el.querySelector('input[type=password]').value;
                this.chatroomview.model.join(this.chatroomview.model.get('nick'), password);
                this.model.set('validation_message', null);
            }
        });


        function setMUCDomain (domain, controlboxview) {
            controlboxview.getRoomsPanel().model.save('muc_domain', Strophe.getDomainFromJid(domain));
        }

        function setMUCDomainFromDisco (controlboxview) {
            /* Check whether service discovery for the user's domain
             * returned MUC information and use that to automatically
             * set the MUC domain in the "Add groupchat" modal.
             */
            function featureAdded (feature) {
                if (!feature) { return; }
                if (feature.get('var') === Strophe.NS.MUC) {
                    feature.entity.getIdentity('conference', 'text').then(identity => {
                        if (identity) {
                            setMUCDomain(feature.get('from'), controlboxview);
                        }
                    });
                }
            }
            api.waitUntil('discoInitialized').then(() => {
                api.listen.on('serviceDiscovered', featureAdded);
                // Features could have been added before the controlbox was
                // initialized. We're only interested in MUC
                _converse.disco_entities.each(entity => featureAdded(entity.features.findWhere({'var': Strophe.NS.MUC })));
            }).catch(e => log.error(e));
        }

        function fetchAndSetMUCDomain (controlboxview) {
            if (controlboxview.model.get('connected')) {
                if (!controlboxview.getRoomsPanel().model.get('muc_domain')) {
                    if (api.settings.get('muc_domain') === undefined) {
                        setMUCDomainFromDisco(controlboxview);
                    } else {
                        setMUCDomain(api.settings.get('muc_domain'), controlboxview);
                    }
                }
            }
        }


        /************************ BEGIN Event Handlers ************************/
        api.listen.on('chatBoxViewsInitialized', () => {

            function openChatRoomFromURIClicked (ev) {
                ev.preventDefault();
                api.rooms.open(ev.target.href);
            }
            _converse.chatboxviews.delegate('click', 'a.open-chatroom', openChatRoomFromURIClicked);

            async function addView (model) {
                const views = _converse.chatboxviews;
                if (!views.get(model.get('id')) &&
                        model.get('type') === _converse.CHATROOMS_TYPE &&
                        model.isValid()
                ) {
                    await model.initialized;
                    return views.add(model.get('id'), new _converse.ChatRoomView({model}));
                }
            }
            _converse.chatboxes.on('add', addView);
        });

        api.listen.on('clearSession', () => {
            const view = _converse.chatboxviews.get('controlbox');
            if (view && view.roomspanel) {
                view.roomspanel.model.destroy();
                view.roomspanel.remove();
                delete view.roomspanel;
            }
        });

        api.listen.on('controlBoxInitialized', (view) => {
            if (!api.settings.get('allow_muc')) {
                return;
            }
            fetchAndSetMUCDomain(view);
            view.model.on('change:connected', () => fetchAndSetMUCDomain(view));
        });
        /************************ END Event Handlers ************************/


        /************************ BEGIN API ************************/
        Object.assign(_converse.api, {
            /**
             * The "roomviews" namespace groups methods relevant to chatroom
             * (aka groupchats) views.
             *
             * @namespace _converse.api.roomviews
             * @memberOf _converse.api
             */
            roomviews: {
                /**
                 * Retrieves a groupchat (aka chatroom) view. The chat should already be open.
                 *
                 * @method _converse.api.roomviews.get
                 * @param {String|string[]} name - e.g. 'coven@conference.shakespeare.lit' or
                 *  ['coven@conference.shakespeare.lit', 'cave@conference.shakespeare.lit']
                 * @returns {View} View representing the groupchat
                 *
                 * @example
                 * // To return a single view, provide the JID of the groupchat
                 * const view = _converse.api.roomviews.get('coven@conference.shakespeare.lit');
                 *
                 * @example
                 * // To return an array of views, provide an array of JIDs:
                 * const views = _converse.api.roomviews.get(['coven@conference.shakespeare.lit', 'cave@conference.shakespeare.lit']);
                 *
                 * @example
                 * // To return views of all open groupchats, call the method without any parameters::
                 * const views = _converse.api.roomviews.get();
                 *
                 */
                get (jids) {
                    if (Array.isArray(jids)) {
                        const views = api.chatviews.get(jids);
                        return views.filter(v => v.model.get('type') === _converse.CHATROOMS_TYPE)
                    } else {
                        const view = api.chatviews.get(jids);
                        if (view.model.get('type') === _converse.CHATROOMS_TYPE) {
                            return view;
                        } else {
                            return null;
                        }
                    }
                },
                /**
                 * Lets you close open chatrooms.
                 *
                 * You can call this method without any arguments to close
                 * all open chatrooms, or you can specify a single JID or
                 * an array of JIDs.
                 *
                 * @method _converse.api.roomviews.close
                 * @param {(String[]|String)} jids The JID or array of JIDs of the chatroom(s)
                 * @returns { Promise } - Promise which resolves once the views have been closed.
                 */
                close (jids) {
                    let views;
                    if (jids === undefined) {
                        views = _converse.chatboxviews;
                    } else if (typeof jids === 'string') {
                        views = [_converse.chatboxviews.get(jids)].filter(v => v);
                    } else if (Array.isArray(jids)) {
                        views = jids.map(jid => _converse.chatboxviews.get(jid));
                    }
                    return Promise.all(views.map(v => (v.is_chatroom && v.model && v.close())))
                }
            }
        });
    }
});
