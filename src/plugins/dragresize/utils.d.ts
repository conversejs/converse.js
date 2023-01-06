export function onStartVerticalResize(ev: any, trigger?: boolean): boolean;
export function onStartHorizontalResize(ev: any, trigger?: boolean): boolean;
export function onStartDiagonalResize(ev: any): void;
/**
 * Applies some resistance to `value` around the `default_value`.
 * If value is close enough to `default_value`, then it is returned, otherwise
 * `value` is returned.
 * @param { Integer } value
 * @param { Integer } default_value
 * @returns { Integer }
 */
export function applyDragResistance(value: Integer, default_value: Integer): Integer;
export function onMouseMove(ev: any): boolean;
export function onMouseUp(ev: any): boolean;
