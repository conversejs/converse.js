/**
 * Whether Ctrl is held, or Cmd on macOS, without Alt.
 * @param {KeyboardEvent} ev
 */
export function isCtrlOrCmd(ev: KeyboardEvent): boolean;
/**
 * @param {KeyboardEvent} ev
 */
export function isAltShift(ev: KeyboardEvent): boolean;
export function addHelpShortcut(): void;
/**
 * @param {KeyboardEvent} ev
 */
export function onKeyDown(ev: KeyboardEvent): void;
/** @type {Map<string, import('./types').KeyboardShortcut>} */
export const shortcuts: Map<string, import("./types").KeyboardShortcut>;
//# sourceMappingURL=shortcuts.d.ts.map