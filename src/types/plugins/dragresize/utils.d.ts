export function registerGlobalEventHandlers(): void;
export function unregisterGlobalEventHandlers(): void;
/**
 * This function registers mousedown and mouseup events hadlers to
 * all iframes in the DOM when converse UI resizing events are called
 * to prevent mouse drag stutter effect which is bad user experience.
 * @param {Element} e - dragging node element.
 */
export function dragresizeOverIframeHandler(e: Element): void;
/**
 * @param {import('@converse/headless/types/shared/chatbox').default} model
 */
export function initializeDragResize(model: import("@converse/headless/types/shared/chatbox").default): void;
/**
 * @returns {string}
 */
export function getResizingDirection(): string;
export function onStartVerticalResize(ev: any, trigger?: boolean): boolean;
export function onStartHorizontalResize(ev: any, trigger?: boolean): boolean;
export function onStartDiagonalResize(ev: any): void;
/**
 * Applies some resistance to `value` around the `default_value`.
 * If value is close enough to `default_value`, then it is returned, otherwise
 * `value` is returned.
 * @param { number } value
 * @param { number } default_value
 * @returns { number }
 */
export function applyDragResistance(value: number, default_value: number): number;
export function onMouseMove(ev: any): boolean;
export function onMouseUp(ev: any): boolean;
export type ResizingData = {
    chatbox: HTMLElement;
    direction: string;
};
//# sourceMappingURL=utils.d.ts.map