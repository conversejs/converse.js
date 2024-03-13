export default MUCOccupants;
export type MemberListItem = any;
/**
 * A list of {@link MUCOccupant} instances, representing participants in a MUC.
 * @class
 * @memberOf _converse
 */
declare class MUCOccupants extends Collection {
    constructor(attrs: any, options: any);
    chatroom: any;
    get model(): typeof MUCOccupant;
    create(attrs: any, options: any): false | Model | import("@converse/skeletor/src/types/collection.js").Attributes | (Promise<any> & {
        isResolved: boolean;
        isPending: boolean;
        isRejected: boolean;
        resolve: Function;
        reject: Function;
    });
    fetchMembers(): Promise<void>;
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
    findOccupant(data: {
        jid?: string;
        nick?: string;
        /**
         * - The XEP-0421 unique occupant id
         */
        occupant_id?: string;
    }): any;
    /**
     * Get the {@link MUCOccupant} instance which
     * represents the current user.
     * @method _converse.MUCOccupants#getOwnOccupant
     * @returns {MUCOccupant}
     */
    getOwnOccupant(): MUCOccupant;
}
import { Collection } from "@converse/skeletor";
import MUCOccupant from "./occupant.js";
import { Model } from "@converse/skeletor";
//# sourceMappingURL=occupants.d.ts.map