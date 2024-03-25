import { Model } from '@converse/skeletor';
import { colorize } from '../../utils/color.js';

/**
 * Represents a participant in a MUC
 * @class
 * @namespace _converse.MUCOccupant
 * @memberOf _converse
 */
class MUCOccupant extends Model {

    constructor (attributes, options) {
        super(attributes, options);
        this.vcard = null;
    }

    initialize () {
        this.on('change:nick', () => this.setColor());
        this.on('change:jid', () => this.setColor());
    }

    defaults () {
        return {
            hats: [],
            show: 'offline',
            states: []
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

    async setColor () {
        const color = await colorize(this.getDisplayName());
        this.save({ color });
    }

    async getColor () {
        if (!this.get('color')) {
            await this.setColor();
        }
        return this.get('color');
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

export default MUCOccupant;
