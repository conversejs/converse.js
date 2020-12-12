import u from '../../utils/form';
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api } from '../../core.js';

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

    initialize (attributes) {
        this.set(Object.assign({ 'id': u.getUniqueId() }, attributes));
        this.on('change:image_hash', this.onAvatarChanged, this);
    },

    onAvatarChanged () {
        const hash = this.get('image_hash');
        const vcards = [];
        if (this.get('jid')) {
            vcards.push(_converse.vcards.findWhere({ 'jid': this.get('jid') }));
        }
        vcards.push(_converse.vcards.findWhere({ 'jid': this.get('from') }));

        vcards
            .filter(v => v)
            .forEach(vcard => {
                if (hash && vcard.get('image_hash') !== hash) {
                    api.vcard.update(vcard, true);
                }
            });
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
