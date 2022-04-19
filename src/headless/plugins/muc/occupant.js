import { Model } from '@converse/skeletor/src/model.js';

/**
 * Represents a participant in a MUC
 * @class
 * @namespace _converse.ChatRoomOccupant
 * @memberOf _converse
 */
const ChatRoomOccupant = Model.extend({
    defaults: {
        'hats': [],
        'show': 'offline',
        'states': []
    },

    getDisplayName () {
        return this.get('nick') || this.get('jid');
    },

    isMember () {
        return ['admin', 'owner', 'member'].includes(this.get('affiliation'));
    },

    isModerator () {
        return ['admin', 'owner'].includes(this.get('affiliation')) || this.get('role') === 'moderator';
    },

    isSelf () {
        return this.get('states').includes('110');
    }
});

export default ChatRoomOccupant;
