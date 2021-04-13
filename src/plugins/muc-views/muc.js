import BaseChatView from 'shared/chat/baseview.js';
import ModeratorToolsModal from './modals/moderator-tools.js';
import log from '@converse/headless/log';
import tpl_muc from './templates/muc.js';
import { Model } from '@converse/skeletor/src/model.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core';
import { html, render } from "lit-html";

/**
 * Mixin which turns a ChatBoxView into a ChatRoomView
 * @mixin
 * @namespace _converse.ChatRoomView
 * @memberOf _converse
 */
export default class MUCView extends BaseChatView {
    length = 300
    is_chatroom = true

    async initialize () {
        const jid = this.getAttribute('jid');
        this.model = _converse.chatboxes.get(jid);
        _converse.chatboxviews.add(jid, this);
        this.initDebounced();

        this.listenTo(_converse, 'windowStateChanged', this.onWindowStateChanged);
        this.listenTo(this.model, 'change:composing_spoiler', this.renderMessageForm);
        this.listenTo(this.model, 'change:hidden', () => this.afterShown());
        this.listenTo(this.model, 'change:minimized', () => this.afterShown());
        this.listenTo(this.model, 'show', this.show);
        this.listenTo(this.model.session, 'change:connection_status', this.updateAfterTransition);
        this.listenTo(this.model.session, 'change:view', this.render);

        await this.render();

        // Need to be registered after render has been called.
        this.listenTo(this.model.messages, 'add', this.onMessageAdded);
        this.listenTo(this.model.occupants, 'change:show', this.showJoinOrLeaveNotification);

        this.updateAfterTransition();
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
        this.setAttribute('id', this.model.get('box_id'));
        render(
            tpl_muc({
                'getNicknameRequiredTemplate': () => this.getNicknameRequiredTemplate(),
                'model': this.model,
            }),
            this
        );
        !this.model.get('hidden') && this.show();
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

    getNicknameRequiredTemplate () {
        const jid = this.model.get('jid');
        if (api.settings.get('muc_show_logs_before_join')) {
            return html`<converse-muc-chatarea jid="${jid}"></converse-muc-chatarea>`;
        } else {
            return html`<converse-muc-nickname-form jid="${jid}"></converse-muc-nickname-form>`;
        }
    }

    updateAfterTransition () {
        const conn_status = this.model.session.get('connection_status');
        if (conn_status === converse.ROOMSTATUS.CONNECTING) {
            this.model.save({
                'disconnection_actor': undefined,
                'disconnection_message': undefined,
                'disconnection_reason': undefined,
                'moved_jid': undefined,
                'password_validation_message': undefined,
                'reason': undefined,
            });
        }
        this.render();
    }
}

api.elements.define('converse-muc', MUCView);
