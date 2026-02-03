export default MUCOccupants;
export type MemberListItem = any;
export type ModelAttributes = import("@converse/skeletor/dist/skeletor.d").ModelAttributes;
export type CollectionOptions = import("@converse/skeletor/dist/skeletor.d").CollectionOptions;
export type Options = import("@converse/skeletor/dist/skeletor.d").Options;
/**
 * A list of {@link MUCOccupant} instances, representing participants in a MUC.
 * @memberOf _converse
 * @extends {Collection<MUCOccupant>}
 */
declare class MUCOccupants extends Collection<MUCOccupant> {
    static getAutoFetchedAffiliationLists(): any[];
    constructor(attrs: any, options: any);
    chatroom: any;
    get model(): typeof MUCOccupant;
    initialize(): void;
    /**
     * @param {Model|ModelAttributes} attrs
     * @param {Options} [options]
     */
    create(attrs: Model | ModelAttributes, options?: Options): MUCOccupant | Promise<MUCOccupant>;
    fetchMembers(): Promise<void>;
    /**
     * Try to find an existing occupant based on the provided {@link OccupantData} object.
     * Fetching the user by `occupant_id` is the quickest, O(1),
     * since it's a dictionary lookup.
     * Fetching by jid or nick is O(n), since it requires traversing an array.
     * Lookup by occupant_id is done first, then jid, and then nick.
     *
     * @param {import('./types').OccupantData} data
     * @returns {MUCOccupant}
     */
    findOccupant(data: import("./types").OccupantData): MUCOccupant;
    /**
     * Get the {@link MUCOccupant} instance which
     * represents the current user.
     * @method _converse.MUCOccupants#getOwnOccupant
     * @returns {MUCOccupant}
     */
    getOwnOccupant(): MUCOccupant;
}
import MUCOccupant from './occupant.js';
import { Collection } from '@converse/skeletor';
import { Model } from '@converse/skeletor';
//# sourceMappingURL=occupants.d.ts.map