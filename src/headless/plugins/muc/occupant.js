import { Model } from '@converse/skeletor';
import api from '../../shared/api/index.js';
import { AFFILIATIONS, ROLES } from './constants.js';
import u from '../../utils/index.js';

const { safeSave, colorize } = u;

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

    /**
     * Return roles which may be assigned to this occupant
     * @returns {typeof ROLES} - An array of assignable roles
     */
    getAssignableRoles () {
        let disabled = api.settings.get('modtools_disable_assign');
        if (!Array.isArray(disabled)) {
            disabled = disabled ? ROLES : [];
        }
        if (this.get('role') === 'moderator') {
            return ROLES.filter(r => !disabled.includes(r));
        } else {
            return [];
        }
    }

    /**
    * Return affiliations which may be assigned by this occupant
    * @returns {typeof AFFILIATIONS} An array of assignable affiliations
    */
    getAssignableAffiliations () {
        let disabled = api.settings.get('modtools_disable_assign');
        if (!Array.isArray(disabled)) {
            disabled = disabled ? AFFILIATIONS : [];
        }
        if (this.get('affiliation') === 'owner') {
            return AFFILIATIONS.filter(a => !disabled.includes(a));
        } else if (this.get('affiliation') === 'admin') {
            return AFFILIATIONS.filter(a => !['owner', 'admin', ...disabled].includes(a));
        } else {
            return [];
        }
    }

    async setColor () {
        const color = await colorize(this.getDisplayName());
        safeSave(this, { color });
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
