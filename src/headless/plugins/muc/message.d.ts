export default ChatRoomMessageMixin;
declare namespace ChatRoomMessageMixin {
    function initialize(): void;
    function getDisplayName(): any;
    /**
     * Determines whether this messsage may be moderated,
     * based on configuration settings and server support.
     * @async
     * @private
     * @method _converse.ChatRoomMessages#mayBeModerated
     * @returns { Boolean }
     */
    function mayBeModerated(): boolean;
    function checkValidity(): any;
    function onOccupantRemoved(): void;
    function onOccupantAdded(occupant: any): void;
    function setOccupant(): void;
}
