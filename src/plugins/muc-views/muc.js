import BaseChatView from 'shared/chat/baseview.js';
import tpl_muc from './templates/muc.js';
import { _converse, api, converse } from '@converse/headless/core';


export default class MUCView extends BaseChatView {
    length = 300
    is_chatroom = true

    async initialize () {
        this.model = await api.rooms.get(this.jid);
        _converse.chatboxviews.add(this.jid, this);
        this.setAttribute('id', this.model.get('box_id'));

        this.listenTo(_converse, 'windowStateChanged', this.onWindowStateChanged);
        this.listenTo(this.model, 'change:composing_spoiler', this.requestUpdateMessageForm);
        this.listenTo(this.model.session, 'change:connection_status', this.onConnectionStatusChanged);
        this.listenTo(this.model.session, 'change:view', () => this.requestUpdate());

        this.onConnectionStatusChanged();
        this.model.maybeShow();
        /**
         * Triggered once a {@link _converse.ChatRoomView} has been opened
         * @event _converse#chatRoomViewInitialized
         * @type { _converse.ChatRoomView }
         * @example _converse.api.listen.on('chatRoomViewInitialized', view => { ... });
         */
        api.trigger('chatRoomViewInitialized', this);
    }

    render () {
        return tpl_muc({ 'model': this.model });
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
