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
            this.on('change:put', () => this.uploadFile());
        }
        // If `type` changes from `error` to `groupchat`, we want to set the occupant. See #2733
        this.on('change:type', () => this.setOccupant());
        this.on('change:is_ephemeral', () => this.setTimerForEphemeralMessage());

        this.setTimerForEphemeralMessage();
        this.setOccupant();
        /**
         * Triggered once a { @link _converse.ChatRoomMessage } has been created and initialized.
         * @event _converse#chatRoomMessageInitialized
         * @type { _converse.ChatRoomMessages}
         * @example _converse.api.listen.on('chatRoomMessageInitialized', model => { ... });
         */
        api.trigger('chatRoomMessageInitialized', this);
    },


    getDisplayName () {
        return this.occupant?.getDisplayName() || this.get('nick');
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
        if (typeof this.get('from_muc')  === 'undefined') {
            // If from_muc is not defined, then this message hasn't been
            // reflected yet, which means we won't have a XEP-0359 stanza id.
            return;
        }
        return (
            ['all', 'moderator'].includes(api.settings.get('allow_message_retraction')) &&
            this.get(`stanza_id ${this.get('from_muc')}`) &&
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
        if (this.get('occupant_id')) {
            if (occupant.get('occupant_id') !== this.get('occupant_id')) {
                return;
            }
        } else if (occupant.get('nick') !== Strophe.getResourceFromJid(this.get('from'))) {
            return;
        }
        const chatbox = this?.collection?.chatbox;
        if (!chatbox) {
            return log.error(`Could not get collection.chatbox for message: ${JSON.stringify(this.toJSON())}`);
        }

        this.occupant = occupant;
        if (occupant.get('jid')) {
            this.save('from_real_jid', occupant.get('jid'));
        }

        this.trigger('occupantAdded');
        this.listenTo(this.occupant, 'destroy', this.onOccupantRemoved);
        this.stopListening(chatbox.occupants, 'add', this.onOccupantAdded);
    },

    setOccupant () {
        if (this.get('type') !== 'groupchat' || this.isEphemeral() || this.occupant) {
            return;
        }
        const chatbox = this?.collection?.chatbox;
        if (!chatbox) {
            return log.error(`Could not get collection.chatbox for message: ${JSON.stringify(this.toJSON())}`);
        }
        const nick = Strophe.getResourceFromJid(this.get('from'));
        const occupant_id = this.get('occupant_id');
        this.occupant = chatbox.occupants.findOccupant({ nick, occupant_id });

        if (!this.occupant && api.settings.get('muc_send_probes')) {
            this.occupant = chatbox.occupants.create({ nick, occupant_id, 'type': 'unavailable' });
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
