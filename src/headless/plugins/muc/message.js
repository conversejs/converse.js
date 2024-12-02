import Message from '../chat/message.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import { Strophe } from 'strophe.js';


class MUCMessage extends Message {
    /**
     * @typedef {import('./occupant').default} MUCOccupant
     */

    async initialize () { // eslint-disable-line require-await
        this.chatbox = this.collection?.chatbox;
        if (!this.checkValidity()) return;

        if (this.get('file')) {
            this.on('change:put', () => this.uploadFile());
        }
        // If `type` changes from `error` to `groupchat`, we want to set the occupant. See #2733
        this.on('change:type', () => this.setOccupant());
        this.on('change:is_ephemeral', () => this.setTimerForEphemeralMessage());

        this.setTimerForEphemeralMessage();
        this.setOccupant();
        /**
         * Triggered once a { @link MUCMessage} has been created and initialized.
         * @event _converse#chatRoomMessageInitialized
         * @type {MUCMessage}
         * @example _converse.api.listen.on('chatRoomMessageInitialized', model => { ... });
         */
        api.trigger('chatRoomMessageInitialized', this);
    }

    getDisplayName () {
        return this.occupant?.getDisplayName() || this.get('nick');
    }

    /**
     * Determines whether this messsage may be moderated,
     * based on configuration settings and server support.
     * @async
     * @method _converse.ChatRoomMessages#mayBeModerated
     * @returns {boolean}
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
    }

    checkValidity () {
        const result = _converse.exports.Message.prototype.checkValidity.call(this);
        !result && this.chatbox.debouncedRejoin();
        return result;
    }

    onOccupantRemoved () {
        this.stopListening(this.occupant);
        delete this.occupant;
        this.listenTo(this.chatbox.occupants, 'add', this.onOccupantAdded);
    }

    /**
     * @param {MUCOccupant} [occupant]
     */
    onOccupantAdded (occupant) {
        if (this.get('occupant_id')) {
            if (occupant.get('occupant_id') !== this.get('occupant_id')) {
                return;
            }
        } else if (occupant.get('nick') !== Strophe.getResourceFromJid(this.get('from'))) {
            return;
        }
        this.setOccupant(occupant)
    }

    getOccupant() {
        return this.occupant || this.setOccupant();
    }

    /**
     * @param {MUCOccupant} [occupant]
     * @return {MUCOccupant}
     */
    setOccupant (occupant) {
        if (this.get('type') !== 'groupchat' || this.isEphemeral()) {
            return;
        }

        if (occupant) {
            this.occupant = occupant;

        } else {
            if (this.occupant) return;

            const nick = Strophe.getResourceFromJid(this.get('from'));
            const occupant_id = this.get('occupant_id');
            this.occupant = (nick || occupant_id) ? this.chatbox.occupants.findOccupant({ nick, occupant_id }) : null;

            if (!this.occupant) {
                const jid = this.get('from_real_jid');
                if (!nick && !occupant_id && !jid) {
                    // Tombstones of retracted messages might have no occupant info
                    return;
                }

                this.occupant = this.chatbox.occupants.create({ nick, occupant_id, jid });

                if (api.settings.get('muc_send_probes')) {
                    const jid = `${this.chatbox.get('jid')}/${nick}`;
                    api.user.presence.send('probe', jid);
                }
            }
        }

        if (this.get('from_real_jid') !== this.occupant.get('jid')) {
            this.save('from_real_jid', this.occupant.get('jid'));
        }

        this.trigger('occupant:add');
        this.listenTo(this.occupant, 'change', (changed) => this.trigger('occupant:change', changed));
        this.listenTo(this.occupant, 'destroy', this.onOccupantRemoved);
        this.stopListening(this.chatbox.occupants, 'add', this.onOccupantAdded);

        return this.occupant;
    }
}

export default MUCMessage;
