import { Model } from '@converse/skeletor';

/**
 * Represents a VCard
 * @namespace _converse.VCard
 * @memberOf _converse
 */
class VCard extends Model {
    get idAttribute () {
        return 'jid';
    }

    getDisplayName () {
        return this.get('nickname') || this.get('fullname') || this.get('jid');
    }
}

export default VCard;
