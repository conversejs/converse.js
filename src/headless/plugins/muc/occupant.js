import { Model } from '@converse/skeletor/src/model.js';

/**
 * Represents a participant in a MUC
 * @class
 * @namespace _converse.ChatRoomOccupant
 * @memberOf _converse
 */
class ChatRoomOccupant extends Model {

    defaults () { // eslint-disable-line class-methods-use-this
        return {
            'hats': [],
            'show': 'offline',
            'states': []
        }
    }

    save (key, val, options) {
        let attrs;
        if (key == null) { // eslint-disable-line no-eq-null
            return super.save(key, val, options);
        } else if (typeof key === 'object') {
            attrs = key;
            options = val;
        } else {
            (attrs = {})[key] = val;
        }

        if (attrs.occupant_id) {
            attrs.id = attrs.occupant_id;
        }
        return super.save(attrs, options);
    }

    getDisplayName () {
        return this.get('nick') || this.get('jid');
    }

    isMember () {
        return ['admin', 'owner', 'member'].includes(this.get('affiliation'));
    }

    isModerator () {
        return ['admin', 'owner'].includes(this.get('affiliation')) || this.get('role') === 'moderator';
    }

    isSelf () {
        return this.get('states').includes('110');
    }
}

export default ChatRoomOccupant;
