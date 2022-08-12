import ChatRoomOccupant from './occupant.js';
import u from '../../utils/form';
import { Collection } from '@converse/skeletor/src/collection.js';
import { MUC_ROLE_WEIGHTS } from './constants.js';
import { Model } from '@converse/skeletor/src/model.js';
import { Strophe } from 'strophe.js/src/strophe.js';
import { _converse, api } from '../../core.js';
import { getAffiliationList } from './affiliations/utils.js';
import { getAutoFetchedAffiliationLists } from './utils.js';
import { getUniqueId } from '@converse/headless/utils/core.js';


/**
 * A list of {@link _converse.ChatRoomOccupant} instances, representing participants in a MUC.
 * @class
 * @namespace _converse.ChatRoomOccupants
 * @memberOf _converse
 */
class ChatRoomOccupants extends Collection {
    model = ChatRoomOccupant;

    comparator (occupant1, occupant2) { // eslint-disable-line class-methods-use-this
        const role1 = occupant1.get('role') || 'none';
        const role2 = occupant2.get('role') || 'none';
        if (MUC_ROLE_WEIGHTS[role1] === MUC_ROLE_WEIGHTS[role2]) {
            const nick1 = occupant1.getDisplayName().toLowerCase();
            const nick2 = occupant2.getDisplayName().toLowerCase();
            return nick1 < nick2 ? -1 : nick1 > nick2 ? 1 : 0;
        } else {
            return MUC_ROLE_WEIGHTS[role1] < MUC_ROLE_WEIGHTS[role2] ? -1 : 1;
        }
    }

    create (attrs, options) {
        if (attrs.id || attrs instanceof Model) {
            return super.create(attrs, options);
        }
        attrs.id = attrs.occupant_id || getUniqueId();
        return super.create(attrs, options);
    }

    async fetchMembers () {
        if (!['member', 'admin', 'owner'].includes(this.getOwnOccupant()?.get('affiliation'))) {
            // https://xmpp.org/extensions/xep-0045.html#affil-priv
            return;
        }
        const affiliations = getAutoFetchedAffiliationLists();
        if (affiliations.length === 0) {
            return;
        }
        const muc_jid = this.chatroom.get('jid');
        const aff_lists = await Promise.all(affiliations.map(a => getAffiliationList(a, muc_jid)));
        const new_members = aff_lists.reduce((acc, val) => (u.isErrorObject(val) ? acc : [...val, ...acc]), []);
        const known_affiliations = affiliations.filter(
            a => !u.isErrorObject(aff_lists[affiliations.indexOf(a)])
        );
        const new_jids = new_members.map(m => m.jid).filter(m => m !== undefined);
        const new_nicks = new_members.map(m => (!m.jid && m.nick) || undefined).filter(m => m !== undefined);
        const removed_members = this.filter(m => {
            return (
                known_affiliations.includes(m.get('affiliation')) &&
                !new_nicks.includes(m.get('nick')) &&
                !new_jids.includes(m.get('jid'))
            );
        });
        removed_members.forEach(occupant => {
            if (occupant.get('jid') === _converse.bare_jid) {
                return;
            } else if (occupant.get('show') === 'offline') {
                occupant.destroy();
            } else {
                occupant.save('affiliation', null);
            }
        });
        new_members.forEach(attrs => {
            const occupant = this.findOccupant(attrs);
            occupant ? occupant.save(attrs) : this.create(attrs);
        });
        /**
         * Triggered once the member lists for this MUC have been fetched and processed.
         * @event _converse#membersFetched
         * @example _converse.api.listen.on('membersFetched', () => { ... });
         */
        api.trigger('membersFetched');
    }

    /**
     * @typedef { Object} OccupantData
     * @property { String } [jid]
     * @property { String } [nick]
     * @property { String } [occupant_id] - The XEP-0421 unique occupant id
     */
    /**
     * Try to find an existing occupant based on the provided
     * @link { OccupantData } object.
     *
     * Fetching the user by `occupant_id` is the quickest, O(1),
     * since it's a dictionary lookup.
     *
     * Fetching by jid or nick is O(n), since it requires traversing an array.
     *
     * Lookup by occupant_id is done first, then jid, and then nick.
     *
     * @method _converse.ChatRoomOccupants#findOccupant
     * @param { OccupantData } data
     */
    findOccupant (data) {
        if (data.occupant_id) {
            return this.get(data.occupant_id);
        }

        const jid = data.jid && Strophe.getBareJidFromJid(data.jid);
        return jid && this.findWhere({ jid }) ||
            data.nick && this.findWhere({ 'nick': data.nick });
    }

    /**
     * Get the {@link _converse.ChatRoomOccupant} instance which
     * represents the current user.
     * @method _converse.ChatRoomOccupants#getOwnOccupant
     * @returns { _converse.ChatRoomOccupant }
     */
    getOwnOccupant () {
        return this.findOccupant({
            'jid': _converse.bare_jid,
            'occupant_id': this.chatroom.get('occupant_id')
        });
    }
}


export default ChatRoomOccupants;
