import './config-form.js';
import './password-form.js';
import 'shared/autocomplete/index.js';
import BaseChatView from 'shared/chat/baseview.js';
import ModeratorToolsModal from 'modals/moderator-tools.js';
import log from '@converse/headless/log';
import tpl_muc from './templates/muc.js';
import tpl_muc_destroyed from './templates/muc-destroyed.js';
import tpl_muc_disconnect from './templates/muc-disconnect.js';
import tpl_muc_nickname_form from './templates/muc-nickname-form.js';
import tpl_spinner from 'templates/spinner.js';
import { Model } from '@converse/skeletor/src/model.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core';
import { render } from 'lit-html';

const { sizzle } = converse.env;
const u = converse.env.utils;

/**
 * Mixin which turns a ChatBoxView into a ChatRoomView
 * @mixin
 * @namespace _converse.ChatRoomView
 * @memberOf _converse
 */
export default class MUCView extends BaseChatView {
    length = 300
    tagName = 'div'
    className = 'chatbox chatroom hidden'
    is_chatroom = true
    events = {
        'click .chatbox-navback': 'showControlBox',
        'click .hide-occupants': 'hideOccupants',
        'click .new-msgs-indicator': 'viewUnreadMessages',
        // Arrow functions don't work here because you can't bind a different `this` param to them.
        'click .occupant-nick': function (ev) {
            this.insertIntoTextArea(ev.target.textContent);
        },
        'mousedown .dragresize-occupants-left': 'onStartResizeOccupants',
        'submit .muc-nickname-form': 'submitNickname'
    }

    async initialize () {
        const jid = this.getAttribute('jid');
        _converse.chatboxviews.add(jid, this);

        this.model = _converse.chatboxes.get(jid);
        this.initDebounced();

        this.listenTo(_converse, 'windowStateChanged', this.onWindowStateChanged);
        this.listenTo(this.model, 'change:composing_spoiler', this.renderMessageForm);
        this.listenTo(this.model, 'change:hidden', () => this.afterShown());
        this.listenTo(this.model, 'change:hidden_occupants', this.onSidebarToggle);
        this.listenTo(this.model, 'change:minimized', () => this.afterShown());
        this.listenTo(this.model, 'configurationNeeded', this.getAndRenderConfigurationForm);
        this.listenTo(this.model, 'show', this.show);
        this.listenTo(this.model.messages, 'change:correcting', this.onMessageCorrecting);
        this.listenTo(this.model.session, 'change:connection_status', this.renderAfterTransition);

        // Bind so that we can pass it to addEventListener and removeEventListener
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);

        await this.render();

        // Need to be registered after render has been called.
        this.listenTo(this.model, 'change:show_help_messages', this.renderHelpMessages);
        this.listenTo(this.model.messages, 'add', this.onMessageAdded);
        this.listenTo(this.model.occupants, 'change:show', this.showJoinOrLeaveNotification);
        this.listenTo(this.model.occupants, 'remove', this.onOccupantRemoved);

        this.renderAfterTransition();
        this.model.maybeShow();
        this.scrollDown();
        /**
         * Triggered once a { @link _converse.ChatRoomView } has been opened
         * @event _converse#chatRoomViewInitialized
         * @type { _converse.ChatRoomView }
         * @example _converse.api.listen.on('chatRoomViewInitialized', view => { ... });
         */
        api.trigger('chatRoomViewInitialized', this);
    }

    render () {
        const sidebar_hidden = !this.shouldShowSidebar();
        this.setAttribute('id', this.model.get('box_id'));
        render(
            tpl_muc({
                sidebar_hidden,
                'model': this.model,
                'occupants': this.model.occupants,
                'show_sidebar':
                    !this.model.get('hidden_occupants') &&
                    this.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED,
                'markScrolled': ev => this.markScrolled(ev),
                'muc_show_logs_before_join': api.settings.get('muc_show_logs_before_join'),
                'show_send_button': _converse.show_send_button
            }),
            this
        );

        this.notifications = this.querySelector('.chat-content__notifications');
        this.content = this.querySelector('.chat-content');
        this.help_container = this.querySelector('.chat-content__help');

        if (
            !api.settings.get('muc_show_logs_before_join') &&
            this.model.session.get('connection_status') !== converse.ROOMSTATUS.ENTERED
        ) {
            this.showSpinner();
        }
        // Render header as late as possible since it's async and we
        // want the rest of the DOM elements to be available ASAP.
        // Otherwise e.g. this.notifications is not yet defined when accessed elsewhere.
        !this.model.get('hidden') && this.show();
    }

    getHelpMessages () {
        const setting = api.settings.get('muc_disable_slash_commands');
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
            `<strong>/register</strong>: ${__('Register your nickname')}`,
            `<strong>/revoke</strong>: ${__("Revoke the user's current affiliation")}`,
            `<strong>/subject</strong>: ${__('Set groupchat subject')}`,
            `<strong>/topic</strong>: ${__('Set groupchat subject (alias for /subject)')}`,
            `<strong>/voice</strong>: ${__('Allow muted user to post messages')}`
        ]
            .filter(line => disabled_commands.every(c => !line.startsWith(c + '<', 9)))
            .filter(line => this.model.getAllowedCommands().some(c => line.startsWith(c + '<', 9)));
    }

    onStartResizeOccupants (ev) {
        this.resizing = true;
        this.addEventListener('mousemove', this.onMouseMove);
        this.addEventListener('mouseup', this.onMouseUp);

        const sidebar_el = this.querySelector('converse-muc-sidebar');
        const style = window.getComputedStyle(sidebar_el);
        this.width = parseInt(style.width.replace(/px$/, ''), 10);
        this.prev_pageX = ev.pageX;
    }

    onMouseMove (ev) {
        if (this.resizing) {
            ev.preventDefault();
            const delta = this.prev_pageX - ev.pageX;
            this.resizeSidebarView(delta, ev.pageX);
            this.prev_pageX = ev.pageX;
        }
    }

    onMouseUp (ev) {
        if (this.resizing) {
            ev.preventDefault();
            this.resizing = false;
            this.removeEventListener('mousemove', this.onMouseMove);
            this.removeEventListener('mouseup', this.onMouseUp);
            const sidebar_el = this.querySelector('converse-muc-sidebar');
            const element_position = sidebar_el.getBoundingClientRect();
            const occupants_width = this.calculateSidebarWidth(element_position, 0);
            const attrs = { occupants_width };
            _converse.connection.connected ? this.model.save(attrs) : this.model.set(attrs);
        }
    }

    resizeSidebarView (delta, current_mouse_position) {
        const sidebar_el = this.querySelector('converse-muc-sidebar');
        const element_position = sidebar_el.getBoundingClientRect();
        if (this.is_minimum) {
            this.is_minimum = element_position.left < current_mouse_position;
        } else if (this.is_maximum) {
            this.is_maximum = element_position.left > current_mouse_position;
        } else {
            const occupants_width = this.calculateSidebarWidth(element_position, delta);
            sidebar_el.style.flex = '0 0 ' + occupants_width + 'px';
        }
    }

    calculateSidebarWidth (element_position, delta) {
        let occupants_width = element_position.width + delta;
        const room_width = this.clientWidth;
        // keeping display in boundaries
        if (occupants_width < room_width * 0.2) {
            // set pixel to 20% width
            occupants_width = room_width * 0.2;
            this.is_minimum = true;
        } else if (occupants_width > room_width * 0.75) {
            // set pixel to 75% width
            occupants_width = room_width * 0.75;
            this.is_maximum = true;
        } else if (room_width - occupants_width < 250) {
            // resize occupants if chat-area becomes smaller than 250px (min-width property set in css)
            occupants_width = room_width - 250;
            this.is_maximum = true;
        } else {
            this.is_maximum = false;
            this.is_minimum = false;
        }
        return occupants_width;
    }

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
    }

    showModeratorToolsModal (affiliation) {
        if (!this.model.verifyRoles(['moderator'])) {
            return;
        }
        let modal = api.modal.get(ModeratorToolsModal.id);
        if (modal) {
            modal.model.set('affiliation', affiliation);
        } else {
            const model = new Model({ 'affiliation': affiliation });
            modal = api.modal.create(ModeratorToolsModal, { model, _converse, 'chatroomview': this });
        }
        modal.show();
    }

    showChatStateNotification (message) {
        if (message.get('sender') === 'me') {
            return;
        }
        return _converse.ChatBoxView.prototype.showChatStateNotification.apply(this, arguments);
    }

    shouldShowSidebar () {
        return (
            !this.model.get('hidden_occupants') &&
            this.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED
        );
    }

    onSidebarToggle () {
        this.querySelector('.occupants')?.setVisibility();
    }

    /**
     * Callback method that gets called after the chat has become visible.
     * @private
     * @method _converse.ChatRoomView#afterShown
     */
    afterShown () {
        if (!this.model.get('hidden') && !this.model.get('minimized')) {
            this.model.clearUnreadMsgCounter();
            this.scrollDown();
        }
    }

    /**
     * Closes this chat box, which implies leaving the groupchat as well.
     * @private
     * @method _converse.ChatRoomView#close
     */
    close () {
        if (_converse.router.history.getFragment() === 'converse/room?jid=' + this.model.get('jid')) {
            _converse.router.navigate('');
        }
        return _converse.ChatBoxView.prototype.close.apply(this, arguments);
    }

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
        this.model.save({ 'hidden_occupants': true });
        this.scrollDown();
    }

    getReason (args) { // eslint-disable-line class-methods-use-this
        return args.includes(',') ? args.slice(args.indexOf(',') + 1).trim() : null;
    }

    async destroy () {
        const messages = [__('Are you sure you want to destroy this groupchat?')];
        let fields = [
            {
                'name': 'challenge',
                'label': __('Please enter the XMPP address of this groupchat to confirm'),
                'challenge': this.model.get('jid'),
                'placeholder': __('name@example.org'),
                'required': true
            },
            {
                'name': 'reason',
                'label': __('Optional reason for destroying this groupchat'),
                'placeholder': __('Reason')
            },
            {
                'name': 'newjid',
                'label': __('Optional XMPP address for a new groupchat that replaces this one'),
                'placeholder': __('replacement@example.org')
            }
        ];
        try {
            fields = await api.confirm(__('Confirm'), messages, fields);
            const reason = fields.filter(f => f.name === 'reason').pop()?.value;
            const newjid = fields.filter(f => f.name === 'newjid').pop()?.value;
            return this.model.sendDestroyIQ(reason, newjid).then(() => this.close());
        } catch (e) {
            log.error(e);
        }
    }

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
            const container_el = this.querySelector('.chatroom-body');
            container_el.insertAdjacentElement('beforeend', this.config_form.el);
        }
        u.showElement(this.config_form.el);
    }

    /**
     * Renders a form which allows the user to choose theirnickname.
     * @private
     * @method _converse.ChatRoomView#renderNicknameForm
     */
    renderNicknameForm () {
        if (api.settings.get('muc_show_logs_before_join')) {
            this.hideSpinner();
            u.showElement(this.querySelector('.chat-area'));
        } else {
            const form = this.querySelector('.muc-nickname-form');
            const tpl_result = tpl_muc_nickname_form(this.model.toJSON());
            const form_el = u.getElementFromTemplateResult(tpl_result);
            if (form) {
                sizzle('.spinner', this).forEach(u.removeElement);
                form.outerHTML = form_el.outerHTML;
            } else {
                this.hideChatRoomContents();
                const container = this.querySelector('.chatroom-body');
                container.insertAdjacentElement('beforeend', form_el);
            }
        }
        u.safeSave(this.model.session, { 'connection_status': converse.ROOMSTATUS.NICKNAME_REQUIRED });
    }

    /**
     * Remove the configuration form without submitting and return to the chat view.
     * @private
     * @method _converse.ChatRoomView#closeForm
     */
    closeForm () {
        sizzle('.chatroom-form-container', this).forEach(e => u.addClass('hidden', e));
        this.renderAfterTransition();
    }

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
            this.model
                .fetchRoomConfiguration()
                .then(iq => this.renderConfigurationForm(iq))
                .catch(e => log.error(e));
        } else {
            this.closeForm();
        }
    }

    hideChatRoomContents () {
        const container_el = this.querySelector('.chatroom-body');
        if (container_el !== null) {
            [].forEach.call(container_el.children, child => child.classList.add('hidden'));
        }
    }

    renderPasswordForm () {
        this.hideChatRoomContents();
        const message = this.model.get('password_validation_message');
        this.model.save('password_validation_message', undefined);

        if (!this.password_form) {
            this.password_form = new _converse.MUCPasswordForm({
                'model': new Model({
                    'validation_message': message
                }),
                'chatroomview': this
            });
            const container_el = this.querySelector('.chatroom-body');
            container_el.insertAdjacentElement('beforeend', this.password_form.el);
        } else {
            this.password_form.model.set('validation_message', message);
        }
        u.showElement(this.password_form.el);
        this.model.session.save('connection_status', converse.ROOMSTATUS.PASSWORD_REQUIRED);
    }

    showDestroyedMessage () {
        u.hideElement(this.querySelector('.chat-area'));
        u.hideElement(this.querySelector('.occupants'));
        sizzle('.spinner', this).forEach(u.removeElement);

        const reason = this.model.get('destroyed_reason');
        const moved_jid = this.model.get('moved_jid');
        this.model.save({
            'destroyed_reason': undefined,
            'moved_jid': undefined
        });
        const container = this.querySelector('.disconnect-container');
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
    }

    showDisconnectMessage () {
        const message = this.model.get('disconnection_message');
        if (!message) {
            return;
        }
        u.hideElement(this.querySelector('.chat-area'));
        u.hideElement(this.querySelector('.occupants'));
        sizzle('.spinner', this).forEach(u.removeElement);

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
        const container = this.querySelector('.disconnect-container');
        render(tpl_muc_disconnect(messages), container);
        u.showElement(container);
    }


    /**
     * Working backwards, get today's most recent join/leave notification
     * from the same user (if any exists) after the most recent chat message.
     * @private
     * @method _converse.ChatRoomView#getPreviousJoinOrLeaveNotification
     * @param {HTMLElement} el
     * @param {string} nick
     */
    getPreviousJoinOrLeaveNotification (el, nick) { // eslint-disable-line class-methods-use-this
        const today = new Date().toISOString().split('T')[0];
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
            if (data.join === nick || data.leave === nick || data.leavejoin === nick || data.joinleave === nick) {
                return el;
            }
            el = el.previousElementSibling;
        }
    }

    /**
     * Rerender the groupchat after some kind of transition. For
     * example after the spinner has been removed or after a
     * form has been submitted and removed.
     * @private
     * @method _converse.ChatRoomView#renderAfterTransition
     */
    renderAfterTransition () {
        const conn_status = this.model.session.get('connection_status');
        if (conn_status === converse.ROOMSTATUS.NICKNAME_REQUIRED) {
            this.renderNicknameForm();
        } else if (conn_status === converse.ROOMSTATUS.PASSWORD_REQUIRED) {
            this.renderPasswordForm();
        } else if (conn_status === converse.ROOMSTATUS.CONNECTING) {
            this.showSpinner();
        } else if (conn_status === converse.ROOMSTATUS.ENTERED) {
            this.hideSpinner();
            this.hideChatRoomContents();
            u.showElement(this.querySelector('.chat-area'));
            this.querySelector('.occupants')?.setVisibility();
            this.scrollDown();
            this.maybeFocus();
        } else if (conn_status === converse.ROOMSTATUS.DISCONNECTED) {
            this.showDisconnectMessage();
        } else if (conn_status === converse.ROOMSTATUS.DESTROYED) {
            this.showDestroyedMessage();
        }
    }

    showSpinner () {
        sizzle('.spinner', this).forEach(u.removeElement);
        this.hideChatRoomContents();
        const container_el = this.querySelector('.chatroom-body');
        container_el.insertAdjacentElement('afterbegin', u.getElementFromTemplateResult(tpl_spinner()));
    }

    /**
     * Check if the spinner is being shown and if so, hide it.
     * Also make sure then that the chat area and occupants
     * list are both visible.
     * @private
     * @method _converse.ChatRoomView#hideSpinner
     */
    hideSpinner () {
        const spinner = this.querySelector('.spinner');
        if (spinner !== null) {
            u.removeElement(spinner);
            this.renderAfterTransition();
        }
        return this;
    }
}

api.elements.define('converse-muc', MUCView);
