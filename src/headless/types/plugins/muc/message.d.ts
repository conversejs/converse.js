export default MUCMessage;
declare class MUCMessage extends Message {
    get occupants(): any;
    /**
     * Determines whether this messsage may be moderated,
     * based on configuration settings and server support.
     * @async
     * @method _converse.ChatRoomMessages#mayBeModerated
     * @returns {boolean}
     */
    mayBeModerated(): boolean;
    checkValidity(): any;
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
import Message from '../chat/message.js';
//# sourceMappingURL=message.d.ts.map