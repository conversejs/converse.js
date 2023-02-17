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

        this.chatbox = this.collection?.chatbox;
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
            this.chatbox.canModerateMessages()
        );
    },

    checkValidity () {
        const result = _converse.Message.prototype.checkValidity.call(this);
        !result && this.chatbox.debouncedRejoin();
        return result;
    },

    onOccupantRemoved () {
        this.stopListening(this.occupant);
        delete this.occupant;
        this.listenTo(this.chatbox.occupants, 'add', this.onOccupantAdded);
    },

    onOccupantAdded (occupant) {
        if (this.get('occupant_id')) {
            if (occupant.get('occupant_id') !== this.get('occupant_id')) {
                return;
            }
        } else if (occupant.get('nick') !== Strophe.getResourceFromJid(this.get('from'))) {
            return;
        }

        this.occupant = occupant;
        if (occupant.get('jid')) {
            this.save('from_real_jid', occupant.get('jid'));
        }

        this.trigger('occupantAdded');
        this.listenTo(this.occupant, 'destroy', this.onOccupantRemoved);
        this.stopListening(this.chatbox.occupants, 'add', this.onOccupantAdded);
    },

    getOccupant() {
        if (this.occupant) return this.occupant;

        this.setOccupant();
        return this.occupant;
    },

    setOccupant () {
        if (this.get('type') !== 'groupchat' || this.isEphemeral() || this.occupant) {
            return;
        }

        const nick = Strophe.getResourceFromJid(this.get('from'));
        const occupant_id = this.get('occupant_id');

        this.occupant = this.chatbox.occupants.findOccupant({ nick, occupant_id });

        if (!this.occupant) {
            this.occupant = this.chatbox.occupants.create({
                nick,
                occupant_id,
                jid: this.get('from_real_jid'),
            });

            if (api.settings.get('muc_send_probes')) {
                const jid = `${this.chatbox.get('jid')}/${nick}`;
                api.user.presence.send('probe', jid);
            }
        }

        this.listenTo(this.occupant, 'destroy', this.onOccupantRemoved);
    }
};

export default ChatRoomMessageMixin;
