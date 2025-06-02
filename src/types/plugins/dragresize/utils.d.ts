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
/**
 * @param {MouseEvent} ev
 * @param {boolean} [trigger=true]
 */
export function onStartVerticalResize(ev: MouseEvent, trigger?: boolean): boolean;
/**
 * @param {MouseEvent} ev
 * @param {boolean} [trigger=true]
 */
export function onStartHorizontalResize(ev: MouseEvent, trigger?: boolean): boolean;
/**
 * @param {MouseEvent} ev
 */
export function onStartDiagonalResize(ev: MouseEvent): void;
/**
 * Applies some resistance to `value` around the `default_value`.
 * If value is close enough to `default_value`, then it is returned, otherwise
 * `value` is returned.
 * @param {number} value
 * @param {number} default_value
 * @returns {number}
 */
export function applyDragResistance(value: number, default_value: number): number;
/**
 * @param {MouseEvent} ev
 */
export function onMouseMove(ev: MouseEvent): boolean;
/**
 * @param {MouseEvent} ev
 */
export function onMouseUp(ev: MouseEvent): boolean;
/**
 * @param {import('@converse/headless/types/shared/chatbox').default} chatbox
 * @param {boolean} should_destroy
 */
export function shouldDestroyOnClose(chatbox: import("@converse/headless/types/shared/chatbox").default, should_destroy: boolean): boolean;
export type ResizingData = {
    chatbox: HTMLElement;
    direction: string;
};
//# sourceMappingURL=utils.d.ts.map