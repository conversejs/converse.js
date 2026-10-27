/**
 * Properties and methods added by the DragResizable mixin.
 */
export interface DragResizableElement {
    model: any;
    height: number;
    width: number;
    prev_pageX: number;
    prev_pageY: number;
    initDragResize(): void;
    setupDragResize(): this;
    getDefaultDimensions(): {
        default_height: number;
        default_width: number;
    };
    setDimensions(): void;
    resizeChatBox(ev: MouseEvent): void;
    setChatBoxHeight(height: number): void;
    setChatBoxWidth(width: number): void;
}
export type DragResizableConstructor = new (...args: any[]) => DragResizableElement;
/**
 * HTMLElement extended with properties and methods added by the DragResizable mixin.
 */
interface DragResizableElementExt extends HTMLElement, DragResizableElement {
}
export type ResizingNamespace = {
    chatbox?: DragResizableElementExt;
    direction?: string;
};
export {};
//# sourceMappingURL=types.d.ts.map