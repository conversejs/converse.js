export default ChatRoomOccupants;
/**
 * A list of {@link _converse.ChatRoomOccupant} instances, representing participants in a MUC.
 * @class
 * @namespace _converse.ChatRoomOccupants
 * @memberOf _converse
 */
declare class ChatRoomOccupants extends Collection {
    model: typeof ChatRoomOccupant;
    comparator(occupant1: any, occupant2: any): 0 | 1 | -1;
    create(attrs: any, options: any): any;
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
     * @method _converse.ChatRoomOccupants#findOccupant
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
     * Get the {@link _converse.ChatRoomOccupant} instance which
     * represents the current user.
     * @method _converse.ChatRoomOccupants#getOwnOccupant
     * @returns { _converse.ChatRoomOccupant }
     */
    getOwnOccupant(): _converse.ChatRoomOccupant;
}
import { Collection } from "@converse/skeletor/src/collection.js";
import ChatRoomOccupant from "./occupant.js";
