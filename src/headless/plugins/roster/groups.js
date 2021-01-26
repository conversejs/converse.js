import RosterGroup from './group.js';
import { Collection } from "@converse/skeletor/src/collection";
import { _converse } from "@converse/headless/core";


/**
 * @class
 */
const RosterGroups = Collection.extend({
    model: RosterGroup,

    comparator (a, b) {
        const HEADER_WEIGHTS = {};
        HEADER_WEIGHTS[_converse.HEADER_UNREAD] = 0;
        HEADER_WEIGHTS[_converse.HEADER_REQUESTING_CONTACTS] = 1;
        HEADER_WEIGHTS[_converse.HEADER_CURRENT_CONTACTS]    = 2;
        HEADER_WEIGHTS[_converse.HEADER_UNGROUPED]           = 3;
        HEADER_WEIGHTS[_converse.HEADER_PENDING_CONTACTS]    = 4;

        a = a.get('name');
        b = b.get('name');
        const WEIGHTS =  HEADER_WEIGHTS;
        const special_groups = Object.keys(HEADER_WEIGHTS);
        const a_is_special = special_groups.includes(a);
        const b_is_special = special_groups.includes(b);
        if (!a_is_special && !b_is_special ) {
            return a.toLowerCase() < b.toLowerCase() ? -1 : (a.toLowerCase() > b.toLowerCase() ? 1 : 0);
        } else if (a_is_special && b_is_special) {
            return WEIGHTS[a] < WEIGHTS[b] ? -1 : (WEIGHTS[a] > WEIGHTS[b] ? 1 : 0);
        } else if (!a_is_special && b_is_special) {
            const a_header = _converse.HEADER_CURRENT_CONTACTS;
            return WEIGHTS[a_header] < WEIGHTS[b] ? -1 : (WEIGHTS[a_header] > WEIGHTS[b] ? 1 : 0);
        } else if (a_is_special && !b_is_special) {
            const b_header = _converse.HEADER_CURRENT_CONTACTS;
            return WEIGHTS[a] < WEIGHTS[b_header] ? -1 : (WEIGHTS[a] > WEIGHTS[b_header] ? 1 : 0);
        }
    },

    /**
     * Fetches all the roster groups from sessionStorage.
     * @private
     * @method _converse.RosterGroups#fetchRosterGroups
     * @returns { Promise } - A promise which resolves once the groups have been fetched.
     */
    fetchRosterGroups () {
        return new Promise(success => {
            this.fetch({
                success,
                // We need to first have all groups before
                // we can start positioning them, so we set
                // 'silent' to true.
                silent: true,
            });
        });
    }
});

export default RosterGroups;
