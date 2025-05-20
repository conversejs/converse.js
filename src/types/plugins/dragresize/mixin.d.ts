export default DragResizableMixin;
declare namespace DragResizableMixin {
    function initDragResize(): {
        initDragResize(): any;
        /**
         * @param {MouseEvent} ev
         */
        resizeChatBox(ev: MouseEvent): void;
        setDimensions(): void;
        /**
         * @param {number} height
         */
        setChatBoxHeight(height: number): void;
        /**
         * @param {number} width
         */
        setChatBoxWidth(width: number): void;
        adjustToViewport(): void;
    };
    /**
     * @param {MouseEvent} ev
     */
    function resizeChatBox(ev: MouseEvent): void;
    function setDimensions(): void;
    /**
     * @param {number} height
     */
    function setChatBoxHeight(height: number): void;
    /**
     * @param {number} width
     */
    function setChatBoxWidth(width: number): void;
    function adjustToViewport(): void;
}
//# sourceMappingURL=mixin.d.ts.map