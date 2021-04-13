import ChatRoomOccupant from './occupant.js';
import u from '../../utils/form';
import { Collection } from '@converse/skeletor/src/collection';
import { Strophe } from 'strophe.js/src/strophe';
import { _converse, api } from '../../core.js';
import { getAffiliationList } from './affiliations/utils.js';

const MUC_ROLE_WEIGHTS = {
    'moderator': 1,
    'participant': 2,
    'visitor': 3,
    'none': 2
};


/**
 * A list of {@link _converse.ChatRoomOccupant} instances, representing participants in a MUC.
 * @class
 * @namespace _converse.ChatRoomOccupants
 * @memberOf _converse
 */
const ChatRoomOccupants = Collection.extend({
    model: ChatRoomOccupant,

    comparator (occupant1, occupant2) {
        const role1 = occupant1.get('role') || 'none';
        const role2 = occupant2.get('role') || 'none';
        if (MUC_ROLE_WEIGHTS[role1] === MUC_ROLE_WEIGHTS[role2]) {
            const nick1 = occupant1.getDisplayName().toLowerCase();
            const nick2 = occupant2.getDisplayName().toLowerCase();
            return nick1 < nick2 ? -1 : nick1 > nick2 ? 1 : 0;
        } else {
            return MUC_ROLE_WEIGHTS[role1] < MUC_ROLE_WEIGHTS[role2] ? -1 : 1;
        }
    },

    getAutoFetchedAffiliationLists () {
        const affs = api.settings.get('muc_fetch_members');
        return Array.isArray(affs) ? affs : affs ? ['member', 'admin', 'owner'] : [];
    },

    async fetchMembers () {
        const affiliations = this.getAutoFetchedAffiliationLists();
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
            }
            if (occupant.get('show') === 'offline') {
                occupant.destroy();
            } else {
                occupant.save('affiliation', null);
            }
        });
        new_members.forEach(attrs => {
            const occupant = attrs.jid
                ? this.findOccupant({ 'jid': attrs.jid })
                : this.findOccupant({ 'nick': attrs.nick });
            if (occupant) {
                occupant.save(attrs);
            } else {
                this.create(attrs);
            }
        });
        /**
         * Triggered once the member lists for this MUC have been fetched and processed.
         * @event _converse#membersFetched
         * @example _converse.api.listen.on('membersFetched', () => { ... });
         */
        api.trigger('membersFetched');
    },

    /**
     * @typedef { Object} OccupantData
     * @property { String } [jid]
     * @property { String } [nick]
     */
    /**
     * Try to find an existing occupant based on the passed in
     * data object.
     *
     * If we have a JID, we use that as lookup variable,
     * otherwise we use the nick. We don't always have both,
     * but should have at least one or the other.
     * @private
     * @method _converse.ChatRoomOccupants#findOccupant
     * @param { OccupantData } data
     */
    findOccupant (data) {
        const jid = Strophe.getBareJidFromJid(data.jid);
        return (jid && this.findWhere({ jid })) || this.findWhere({ 'nick': data.nick });
    }
});


export default ChatRoomOccupants;
