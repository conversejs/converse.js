export default MUCOccupants;
export type MemberListItem = any;
export type Attributes = import("@converse/skeletor/src/types/collection").Attributes;
export type CollectionOptions = import("@converse/skeletor/src/types/collection").CollectionOptions;
export type Options = import("@converse/skeletor/src/types/collection").Options;
/**
 * A list of {@link MUCOccupant} instances, representing participants in a MUC.
 * @class
 * @memberOf _converse
 */
declare class MUCOccupants extends Collection {
    static getAutoFetchedAffiliationLists(): any[];
    constructor(attrs: any, options: any);
    chatroom: any;
    get model(): typeof MUCOccupant;
    fetchMembers(): Promise<void>;
    /**
     * Try to find an existing occupant based on the provided {@link OccupantSearchData} object.
     * Fetching the user by `occupant_id` is the quickest, O(1),
     * since it's a dictionary lookup.
     * Fetching by jid or nick is O(n), since it requires traversing an array.
     * Lookup by occupant_id is done first, then jid, and then nick.
     *
     * @param {import('./types').OccupantSearchData} data
     */
    findOccupant(data: import("./types").OccupantSearchData): any;
    /**
     * Get the {@link MUCOccupant} instance which
     * represents the current user.
     * @method _converse.MUCOccupants#getOwnOccupant
     * @returns {MUCOccupant}
     */
    getOwnOccupant(): MUCOccupant;
}
import { Collection } from '@converse/skeletor';
import MUCOccupant from './occupant.js';
//# sourceMappingURL=occupants.d.ts.map