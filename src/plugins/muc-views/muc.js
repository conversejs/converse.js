import BaseChatView from 'shared/chat/baseview.js';
import log from '@converse/headless/log';
import tpl_muc from './templates/muc.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core';


export default class MUCView extends BaseChatView {
    length = 300
    is_chatroom = true

    connectedCallback () {
        super.connectedCallback();
        this.initialize();
    }

    async initialize () {
        this.model = await api.rooms.get(this.jid);
        _converse.chatboxviews.add(this.jid, this);
        this.setAttribute('id', this.model.get('box_id'));

        this.listenTo(_converse, 'windowStateChanged', this.onWindowStateChanged);
        this.listenTo(this.model, 'change:composing_spoiler', this.requestUpdateMessageForm);
        this.listenTo(this.model, 'show', this.show);
        this.listenTo(this.model.session, 'change:connection_status', this.onConnectionStatusChanged);
        this.listenTo(this.model.session, 'change:view', this.requestUpdate);

        this.onConnectionStatusChanged();
        this.model.maybeShow();
        /**
         * Triggered once a { @link _converse.ChatRoomView } has been opened
         * @event _converse#chatRoomViewInitialized
         * @type { _converse.ChatRoomView }
         * @example _converse.api.listen.on('chatRoomViewInitialized', view => { ... });
         */
        api.trigger('chatRoomViewInitialized', this);
    }

    render () {
        return tpl_muc({ 'model': this.model });
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

    onConnectionStatusChanged () {
        const conn_status = this.model.session.get('connection_status');
        if (conn_status === converse.ROOMSTATUS.CONNECTING) {
            this.model.session.save({
                'disconnection_actor': undefined,
                'disconnection_message': undefined,
                'disconnection_reason': undefined,
            });
            this.model.save({
                'moved_jid': undefined,
                'password_validation_message': undefined,
                'reason': undefined,
            });
        }
        this.requestUpdate();
    }
}

api.elements.define('converse-muc', MUCView);
