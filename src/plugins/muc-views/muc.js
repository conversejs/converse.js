import BaseChatView from 'shared/chat/baseview.js';
import tplMuc from './templates/muc.js';
import { _converse, api, converse } from '@converse/headless';


export default class MUCView extends BaseChatView {
    length = 300
    is_chatroom = true

    async initialize () {
        this.model = await api.rooms.get(this.jid);
        _converse.state.chatboxviews.add(this.jid, this);
        this.setAttribute('id', this.model.get('box_id'));

        this.listenTo(this.model.session, 'change:connection_status', this.onConnectionStatusChanged);
        this.listenTo(this.model.session, 'change:view', () => this.requestUpdate());

        document.addEventListener('visibilitychange',  () => this.onWindowStateChanged());

        this.onConnectionStatusChanged();
        this.model.maybeShow();
        /**
         * Triggered once a {@link MUCView} has been opened
         * @event _converse#chatRoomViewInitialized
         * @type {MUCView}
         * @example _converse.api.listen.on('chatRoomViewInitialized', view => { ... });
         */
        api.trigger('chatRoomViewInitialized', this);
    }

    render () {
        return tplMuc(this);
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
