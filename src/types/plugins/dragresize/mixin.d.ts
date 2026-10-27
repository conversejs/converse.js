/**
 * @template {import('shared/components/types').CustomElementExtender} T
 * @param {T} BaseCustomElement
 * @returns {T & import('./types').DragResizableConstructor}
 */
export default function DragResizable<T extends import("shared/components/types").CustomElementExtender>(BaseCustomElement: T): T & import("./types").DragResizableConstructor;
//# sourceMappingURL=mixin.d.ts.map