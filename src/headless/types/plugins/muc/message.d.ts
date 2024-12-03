export default MUCMessage;
declare class MUCMessage extends Message {
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
    onOccupantAdded(occupant?: MUCOccupant): void;
    getOccupant(): any;
    /**
     * @param {MUCOccupant} [occupant]
     * @return {MUCOccupant}
     */
    setOccupant(occupant?: MUCOccupant): MUCOccupant;
    occupant: any;
}
import Message from '../chat/message.js';
import MUCOccupant from './occupant';
//# sourceMappingURL=message.d.ts.map