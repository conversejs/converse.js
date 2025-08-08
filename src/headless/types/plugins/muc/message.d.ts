export default MUCMessage;
declare class MUCMessage extends BaseMessage {
    get occupants(): any;
    getDisplayName(): any;
    /**
     * Determines whether this messsage may be moderated,
     * based on configuration settings and server support.
     * @method _converse.ChatRoomMessages#mayBeModerated
     * @returns {Promise<boolean>}
     */
    mayBeModerated(): Promise<boolean>;
    onOccupantRemoved(): void;
    /**
     * @param {MUCOccupant} [occupant]
     */
    onOccupantAdded(occupant?: import("./occupant").default): void;
    getOccupant(): any;
    /**
     * @param {MUCOccupant} [occupant]
     * @return {MUCOccupant}
     */
    setOccupant(occupant?: import("./occupant").default): import("./occupant").default;
    occupant: any;
}
import BaseMessage from '../../shared/message.js';
//# sourceMappingURL=message.d.ts.map