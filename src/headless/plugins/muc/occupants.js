/**
 * @typedef {module:plugin-muc-parsers.MemberListItem} MemberListItem
 * @typedef {import('@converse/skeletor/src/types/collection').Attributes} Attributes
 * @typedef {import('@converse/skeletor/src/types/collection').CollectionOptions} CollectionOptions
 * @typedef {import('@converse/skeletor/src/types/collection').Options} Options
 */
import MUCOccupant from './occupant.js';
import _converse from '../../shared/_converse.js';
import log from '../../log';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { Collection, Model } from '@converse/skeletor';
import { Strophe } from 'strophe.js';
import { getAffiliationList } from './affiliations/utils.js';
import { getAutoFetchedAffiliationLists, occupantsComparator } from './utils.js';
import { getUniqueId } from '../../utils/index.js';

const { u } = converse.env;


/**
 * A list of {@link MUCOccupant} instances, representing participants in a MUC.
 * @class
 * @memberOf _converse
 */
class MUCOccupants extends Collection {

    /**
     * @param {MUCOccupant[]} attrs
     * @param {CollectionOptions} options
     */
    constructor (attrs, options) {
        super(
            attrs,
            Object.assign({ comparator: occupantsComparator }, options)
        );
        this.chatroom = null;
    }

    get model() {
        return MUCOccupant;
    }

    initialize() {
        this.on('change:nick', () => this.sort());
        this.on('change:role', () => this.sort());
    }

    /**
     * @param {Model|Attributes} attrs
     * @param {Options} [options]
     */
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


        const new_members = aff_lists.reduce(
            /**
             * @param {MemberListItem[]} acc
             * @param {MemberListItem[]|Error} val
             * @returns {MemberListItem[]}
             */
            (acc, val) => {
                if (val instanceof Error) {
                    log.error(val);
                    return acc;
                }
                return [...val, ...acc];
            }, []
        );

        const known_affiliations = affiliations.filter(
            a => !u.isErrorObject(aff_lists[affiliations.indexOf(a)])
        );
        const new_jids = /** @type {MemberListItem[]} */(new_members).map(m => m.jid).filter(m => m !== undefined);

        const new_nicks = /** @type {MemberListItem[]} */(new_members).map(
            (m) => (!m.jid && m.nick) || undefined).filter(m => m !== undefined);

        const removed_members = this.filter(m => {
            return (
                known_affiliations.includes(m.get('affiliation')) &&
                !new_nicks.includes(m.get('nick')) &&
                !new_jids.includes(m.get('jid'))
            );
        });

        const bare_jid = _converse.session.get('bare_jid');
        removed_members.forEach(occupant => {
            if (occupant.get('jid') === bare_jid) {
                return;
            } else if (occupant.get('show') === 'offline') {
                occupant.destroy();
            } else {
                occupant.save('affiliation', null);
            }
        });
        /** @type {MemberListItem[]} */(new_members).forEach(attrs => {
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
     * @method _converse.MUCOccupants#findOccupant
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
     * Get the {@link MUCOccupant} instance which
     * represents the current user.
     * @method _converse.MUCOccupants#getOwnOccupant
     * @returns {MUCOccupant}
     */
    getOwnOccupant () {
        const bare_jid = _converse.session.get('bare_jid');
        return this.findOccupant({
            'jid': bare_jid,
            'occupant_id': this.chatroom.get('occupant_id')
        });
    }
}


export default MUCOccupants;
