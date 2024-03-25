export default MUCOccupant;
/**
 * Represents a participant in a MUC
 * @class
 * @namespace _converse.MUCOccupant
 * @memberOf _converse
 */
declare class MUCOccupant extends Model {
    constructor(attributes: any, options: any);
    vcard: any;
    defaults(): {
        hats: any[];
        show: string;
        states: any[];
    };
    save(key: any, val: any, options: any): any;
    getDisplayName(): any;
    /**
     * Return roles which may be assigned to this occupant
     * @returns {typeof ROLES} - An array of assignable roles
     */
    getAssignableRoles(): typeof ROLES;
    /**
    * Return affiliations which may be assigned by this occupant
    * @returns {typeof AFFILIATIONS} An array of assignable affiliations
    */
    getAssignableAffiliations(): typeof AFFILIATIONS;
    setColor(): Promise<void>;
    getColor(): Promise<any>;
    isMember(): boolean;
    isModerator(): boolean;
    isSelf(): any;
}
import { Model } from "@converse/skeletor";
import { ROLES } from "./constants.js";
import { AFFILIATIONS } from "./constants.js";
//# sourceMappingURL=occupant.d.ts.map