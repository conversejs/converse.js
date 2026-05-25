import { Model } from '@converse/headless';

/**
 * HTMLElement extended with properties and methods added by the DragResizable mixin.
 */
interface DragResizableElementExt extends HTMLElement {
    model: Model;
    height: number;
    width: number;
    prev_pageX: number;
    prev_pageY: number;
    resizeChatBox(ev: MouseEvent): void;
    setChatBoxHeight(height: number): void;
    setChatBoxWidth(width: number): void;
}

export type ResizingNamespace = { chatbox?: DragResizableElementExt; direction?: string };
