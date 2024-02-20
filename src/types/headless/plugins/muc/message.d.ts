export default MUCMessage;
declare class MUCMessage extends Message {
    chatbox: any;
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
    onOccupantAdded(occupant: any): void;
    occupant: any;
    getOccupant(): any;
    setOccupant(): void;
}
import Message from "../chat/message.js";
//# sourceMappingURL=message.d.ts.map