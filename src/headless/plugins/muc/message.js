import log from '../../log';
import { Strophe } from 'strophe.js/src/strophe';
import { _converse, api } from '../../core.js';

/**
 * Mixing that turns a Message model into a ChatRoomMessage model.
 * @class
 * @namespace _converse.ChatRoomMessage
 * @memberOf _converse
 */
const ChatRoomMessageMixin = {
    initialize () {
        if (!this.checkValidity()) {
            return;
        }
        if (this.get('file')) {
            this.on('change:put', this.uploadFile, this);
        }
        if (!this.setTimerForEphemeralMessage()) {
            this.setOccupant();
        }
        /**
         * Triggered once a {@link _converse.ChatRoomMessageInitialized} has been created and initialized.
         * @event _converse#chatRoomMessageInitialized
         * @type { _converse.ChatRoomMessages}
         * @example _converse.api.listen.on('chatRoomMessageInitialized', model => { ... });
         */
        api.trigger('chatRoomMessageInitialized', this);
    },

    /**
     * Determines whether this messsage may be moderated,
     * based on configuration settings and server support.
     * @async
     * @private
     * @method _converse.ChatRoomMessages#mayBeModerated
     * @returns { Boolean }
     */
    mayBeModerated () {
        return (
            ['all', 'moderator'].includes(api.settings.get('allow_message_retraction')) &&
            this.collection.chatbox.canModerateMessages()
        );
    },

    checkValidity () {
        const result = _converse.Message.prototype.checkValidity.call(this);
        !result && this.collection.chatbox.debouncedRejoin();
        return result;
    },

    onOccupantRemoved () {
        this.stopListening(this.occupant);
        delete this.occupant;
        const chatbox = this?.collection?.chatbox;
        if (!chatbox) {
            return log.error(`Could not get collection.chatbox for message: ${JSON.stringify(this.toJSON())}`);
        }
        this.listenTo(chatbox.occupants, 'add', this.onOccupantAdded);
    },

    onOccupantAdded (occupant) {
        if (occupant.get('nick') === Strophe.getResourceFromJid(this.get('from'))) {
            this.occupant = occupant;
            this.trigger('occupantAdded');
            this.listenTo(this.occupant, 'destroy', this.onOccupantRemoved);
            const chatbox = this?.collection?.chatbox;
            if (!chatbox) {
                return log.error(`Could not get collection.chatbox for message: ${JSON.stringify(this.toJSON())}`);
            }
            this.stopListening(chatbox.occupants, 'add', this.onOccupantAdded);
        }
    },

    setOccupant () {
        if (this.get('type') !== 'groupchat') {
            return;
        }
        const chatbox = this?.collection?.chatbox;
        if (!chatbox) {
            return log.error(`Could not get collection.chatbox for message: ${JSON.stringify(this.toJSON())}`);
        }
        const nick = Strophe.getResourceFromJid(this.get('from'));
        this.occupant = chatbox.occupants.findWhere({ nick });

        if (!this.occupant && api.settings.get('muc_send_probes')) {
            this.occupant = chatbox.occupants.create({ nick, 'type': 'unavailable' });
            const jid = `${chatbox.get('jid')}/${nick}`;
            api.user.presence.send('probe', jid);
        }

        if (this.occupant) {
            this.listenTo(this.occupant, 'destroy', this.onOccupantRemoved);
        } else {
            this.listenTo(chatbox.occupants, 'add', this.onOccupantAdded);
        }
    }
};

export default ChatRoomMessageMixin;
